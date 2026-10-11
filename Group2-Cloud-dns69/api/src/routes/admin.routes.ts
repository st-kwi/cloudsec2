// api/src/routes/admin.routes.ts — ทุก route ในไฟล์นี้ต้องเป็น admin
import { Router } from 'express'
import { z } from 'zod'
import { query, queryOne, withTransaction } from '../db.js'
import { asyncHandler, badRequest, notFound, conflict } from '../lib/http.js'
import { requireRole } from '../middleware/auth.js'
import { invalidateLeaderboard } from './leaderboard.routes.js'

export const adminRouter: Router = Router()
// ประกาศครั้งเดียวที่หัวไฟล์ ปลอดภัยกว่าไปใส่ทีละ route แล้วลืมบางอัน
adminRouter.use(requireRole('admin'))

const createSchema = z.object({
  home_code: z.string().min(1).max(10),
  away_code: z.string().min(1).max(10),
  kickoff_at: z.string().datetime({ offset: true, message: 'รูปแบบเวลาไม่ถูกต้อง' }),
})

// POST /api/admin/matches — เพิ่มแมตช์
adminRouter.post('/matches', asyncHandler(async (req, res) => {
  const p = createSchema.safeParse(req.body)
  if (!p.success) throw badRequest(p.error.issues[0].message)
  const { home_code, away_code, kickoff_at } = p.data
  if (home_code === away_code) throw badRequest('ทีมเหย้ากับทีมเยือนต้องเป็นคนละคณะ')
  if (new Date(kickoff_at).getTime() <= Date.now()) throw badRequest('เวลาเริ่มเตะต้องอยู่ในอนาคต')

  const m = await withTransaction(async (c) => {
    const r = await c.query<{ id: number }>(
      `INSERT INTO matches (home_code, away_code, kickoff_at) VALUES ($1, $2, $3) RETURNING id`,
      [home_code, away_code, kickoff_at])
    await c.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, detail) VALUES ($1,'match.create','matches',$2,$3)`,
      [req.user!.sub, r.rows[0].id, JSON.stringify(p.data)])
    return r.rows[0]
  })
  res.status(201).json({ ok: true, id: m.id })
}))

// POST /api/admin/matches/:id/close — ปิดรับคำทายทันที (ตั้ง kickoff = ตอนนี้)
adminRouter.post('/matches/:id/close', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const r = await queryOne<{ id: number }>(
    `UPDATE matches SET kickoff_at = NOW()
      WHERE id = $1 AND settled_at IS NULL AND kickoff_at > NOW() RETURNING id`, [id])
  if (!r) {
    if (!(await queryOne('SELECT 1 FROM matches WHERE id = $1', [id]))) throw notFound('ไม่พบแมตช์นี้')
    throw conflict('แมตช์นี้ปิดรับไปแล้ว')
  }
  await query(`INSERT INTO audit_logs (actor_id, action, entity, entity_id) VALUES ($1,'match.close','matches',$2)`,
    [req.user!.sub, id])
  res.json({ ok: true })
}))

const resultSchema = z.object({
  home: z.coerce.number().int().min(0).max(30),
  away: z.coerce.number().int().min(0).max(30),
})

// POST /api/admin/matches/:id/result — ยืนยันผลและคิดคะแนนทุกคำทาย
// ทำทั้งหมดใน transaction เดียว: ถ้าพังกลางทาง ไม่มีใครได้คะแนนครึ่ง ๆ
adminRouter.post('/matches/:id/result', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const p = resultSchema.safeParse(req.body)
  if (!p.success) throw badRequest('สกอร์ต้องเป็นเลข 0–30')
  const { home, away } = p.data

  const scored = await withTransaction(async (c) => {
    // FOR UPDATE: ล็อกแถวไว้ กันแอดมินสองคนกดยืนยันผลพร้อมกันแล้วคิดคะแนนซ้ำ
    const m = await c.query<{ open: boolean; settled: boolean }>(
      `SELECT (kickoff_at > NOW()) AS open, (settled_at IS NOT NULL) AS settled
         FROM matches WHERE id = $1 FOR UPDATE`, [id])
    if (!m.rowCount) throw notFound('ไม่พบแมตช์นี้')
    if (m.rows[0].settled) throw conflict('แมตช์นี้ยืนยันผลไปแล้ว')
    if (m.rows[0].open) throw conflict('ต้องปิดรับคำทายก่อนจึงจะกรอกผลได้')

    await c.query(
      `UPDATE matches SET result_home = $2, result_away = $3, settled_at = NOW(), settled_by = $4 WHERE id = $1`,
      [id, home, away, req.user!.sub])

    // ตรงเป๊ะ +10 · ทายแพ้ชนะเสมอถูก +3 · ผิด 0
    const r = await c.query(
      `UPDATE predictions SET points = CASE
           WHEN pred_home = $2 AND pred_away = $3                       THEN 10
           WHEN SIGN(pred_home - pred_away) = SIGN($2::int - $3::int)  THEN 3
           ELSE 0 END
        WHERE match_id = $1`, [id, home, away])

    await c.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, detail) VALUES ($1,'match.settle','matches',$2,$3)`,
      [req.user!.sub, id, JSON.stringify({ home, away, predictions_scored: r.rowCount })])
    return r.rowCount ?? 0
  })

  invalidateLeaderboard()
  req.log?.warn({ adminId: req.user!.sub, matchId: id, home, away }, 'match settled')
  res.json({ ok: true, predictions_scored: scored })
}))

// GET /api/admin/audit — 50 รายการล่าสุด (ใช้เก็บ screenshot ประกอบรายงาน)
adminRouter.get('/audit', asyncHandler(async (_req, res) => {
  res.json({ logs: await query(
    `SELECT l.id, l.action, l.entity_id, l.detail, l.created_at, u.display_name AS actor
       FROM audit_logs l LEFT JOIN app_users u ON u.id = l.actor_id
      ORDER BY l.created_at DESC LIMIT 50`) })
}))
