// api/src/routes/matches.routes.ts — รายการแมตช์ คำทาย และคณะ
//
// จุดสำคัญด้าน security: "ปิดรับหรือยัง" ตัดสินด้วย NOW() ของฐานข้อมูลเท่านั้น
// เบราว์เซอร์ไม่ได้ส่งเวลามาเลย แก้นาฬิกาในเครื่องก็ส่งคำทายหลังเริ่มเตะไม่ได้
import { Router } from 'express'
import { z } from 'zod'
import { query, withTransaction } from '../db.js'
import { asyncHandler, badRequest, notFound, conflict } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const matchesRouter: Router = Router()

matchesRouter.get('/faculties', asyncHandler(async (_req, res) => {
  res.json({ faculties: await query('SELECT code, name_th, short_th, color, text_on FROM faculties ORDER BY name_th') })
}))

// GET /api/matches — guest ดูได้ ถ้าล็อกอินจะได้คำทายของตัวเองติดมาด้วย
// ส่ง server_now กลับไปให้หน้าเว็บนับถอยหลังตามนาฬิกา server ไม่ใช่นาฬิกาเครื่องผู้ใช้
matchesRouter.get('/matches', asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT m.id, m.kickoff_at, m.result_home, m.result_away,
            CASE WHEN m.settled_at IS NOT NULL THEN 'done'
                 WHEN m.kickoff_at <= NOW()    THEN 'closed'
                 ELSE 'open' END AS status,
            json_build_object('code',h.code,'short',h.short_th,'name',h.name_th,'color',h.color,'text_on',h.text_on) AS home,
            json_build_object('code',a.code,'short',a.short_th,'name',a.name_th,'color',a.color,'text_on',a.text_on) AS away,
            (SELECT COUNT(*) FROM predictions p WHERE p.match_id = m.id)::int AS prediction_count,
            my.pred_home AS my_home, my.pred_away AS my_away, my.points AS my_points
       FROM matches m
       JOIN faculties h ON h.code = m.home_code
       JOIN faculties a ON a.code = m.away_code
       LEFT JOIN predictions my ON my.match_id = m.id AND my.user_id = $1::uuid
      ORDER BY (m.settled_at IS NOT NULL), m.kickoff_at`,
    [req.user?.sub ?? null])
  const now = await query<{ now: string }>('SELECT NOW() AS now')
  res.json({ matches: rows, server_now: now[0].now })
}))

const predSchema = z.object({
  home: z.coerce.number().int().min(0).max(20),
  away: z.coerce.number().int().min(0).max(20),
})

// PUT /api/matches/:id/prediction — ส่งหรือแก้คำทาย
matchesRouter.put('/matches/:id/prediction', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw badRequest('รหัสแมตช์ไม่ถูกต้อง')
  const p = predSchema.safeParse(req.body)
  if (!p.success) throw badRequest('สกอร์ต้องเป็นเลข 0–20')

  const result = await withTransaction(async (c) => {
    // FOR SHARE: ถ้าแอดมินกำลังกดปิดรับพร้อมกัน คำขอนี้จะรอให้อีกฝั่งเสร็จก่อน
    // แล้วค่อยตรวจเวลา — กันคำทายหลุดเข้ามาในจังหวะเดียวกับที่ปิดรับ
    const m = await c.query<{ open: boolean }>(
      `SELECT (kickoff_at > NOW() AND settled_at IS NULL) AS open
         FROM matches WHERE id = $1 FOR SHARE`, [id])
    if (!m.rowCount) throw notFound('ไม่พบแมตช์นี้')
    if (!m.rows[0].open) throw conflict('ปิดรับคำทายแมตช์นี้แล้ว')

    const r = await c.query<{ inserted: boolean }>(
      `INSERT INTO predictions (user_id, match_id, pred_home, pred_away)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, match_id)
       DO UPDATE SET pred_home = EXCLUDED.pred_home, pred_away = EXCLUDED.pred_away, updated_at = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [req.user!.sub, id, p.data.home, p.data.away])
    return r.rows[0].inserted
  })
  res.status(result ? 201 : 200).json({ ok: true, home: p.data.home, away: p.data.away })
}))

// GET /api/predictions/mine — ประวัติคำทายของตัวเอง
matchesRouter.get('/predictions/mine', requireAuth, asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT m.id AS match_id, m.kickoff_at, m.result_home, m.result_away,
            h.short_th AS home_short, h.color AS home_color, a.short_th AS away_short, a.color AS away_color,
            p.pred_home, p.pred_away, p.points, p.updated_at
       FROM predictions p
       JOIN matches m   ON m.id = p.match_id
       JOIN faculties h ON h.code = m.home_code
       JOIN faculties a ON a.code = m.away_code
      WHERE p.user_id = $1                       -- เห็นได้เฉพาะของตัวเอง
      ORDER BY m.kickoff_at DESC`, [req.user!.sub])
  res.json({ predictions: rows })
}))
