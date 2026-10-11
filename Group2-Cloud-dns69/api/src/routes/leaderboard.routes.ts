// api/src/routes/leaderboard.routes.ts
// cache ในหน่วยความจำ 60 วินาที — หน้าอันดับคนเปิดดูบ่อย ไม่ต้องยิง RDS ทุกครั้ง
// ล้าง cache ทันทีเมื่อแอดมินยืนยันผล (เรียก invalidateLeaderboard)
// หมายเหตุ: มี EC2 2 เครื่อง cache แยกกัน อาจเห็นต่างกันได้ไม่เกิน 60 วินาที
import { Router } from 'express'
import { query } from '../db.js'
import { asyncHandler } from '../lib/http.js'

export const leaderboardRouter: Router = Router()
let cache: { at: number; data: unknown } | null = null
export function invalidateLeaderboard(): void { cache = null }

leaderboardRouter.get('/leaderboard', asyncHandler(async (_req, res) => {
  if (cache && Date.now() - cache.at < 60_000) { res.json({ ...(cache.data as object), cached: true }); return }

  const players = await query(
    `SELECT u.id, u.display_name, f.code AS faculty_code, f.short_th, f.color,
            COALESCE(SUM(p.points), 0)::int                  AS points,
            COUNT(*) FILTER (WHERE p.points = 10)::int        AS exact,
            COUNT(p.points)::int                              AS settled
       FROM app_users u
       JOIN faculties f ON f.code = u.faculty_code
       LEFT JOIN predictions p ON p.user_id = u.id
      WHERE u.is_active AND u.role = 'student'
      GROUP BY u.id, f.code
      ORDER BY points DESC, exact DESC, u.display_name
      LIMIT 100`)

  // เฉลี่ยต่อคน ไม่ใช่ผลรวม — คณะที่คนเยอะจะได้ไม่ได้เปรียบ
  const faculties = await query(
    `WITH per_user AS (
       SELECT u.faculty_code, COALESCE(SUM(p.points), 0) AS points
         FROM app_users u LEFT JOIN predictions p ON p.user_id = u.id
        WHERE u.is_active AND u.role = 'student'
        GROUP BY u.id)
     SELECT f.code, f.short_th, f.color, COUNT(pu.faculty_code)::int AS members,
            COALESCE(ROUND(AVG(pu.points)::numeric, 1), 0)::float AS avg_points
       FROM faculties f LEFT JOIN per_user pu ON pu.faculty_code = f.code
      GROUP BY f.code
      ORDER BY avg_points DESC, members DESC`)

  const data = { players, faculties }
  cache = { at: Date.now(), data }
  res.json({ ...data, cached: false })
}))
