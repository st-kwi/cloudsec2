// api/src/routes/auth.routes.ts — สมัคร / ล็อกอิน / ออกจากระบบ / ข้อมูลตัวเอง
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { query, queryOne } from '../db.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { signSession, setSessionCookie, clearSessionCookie, type Role } from '../lib/jwt.js'
import { asyncHandler, badRequest, unauthorized } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter: Router = Router()

// กัน brute force — 10 ครั้งต่อ 15 นาทีต่อ IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'ลองเข้าสู่ระบบเกินกำหนด กรุณารอ 15 นาที' },
})

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('รูปแบบอีเมลไม่ถูกต้อง').max(255),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128),
  display_name: z.string().trim().min(1, 'กรุณากรอกชื่อที่แสดง').max(40),
  faculty_code: z.string().min(1, 'กรุณาเลือกคณะ').max(10),
})

authRouter.post('/register', asyncHandler(async (req, res) => {
  const p = registerSchema.safeParse(req.body)
  if (!p.success) throw badRequest(p.error.issues[0].message)
  const { email, password, display_name, faculty_code } = p.data

  if (!(await queryOne('SELECT 1 FROM faculties WHERE code = $1', [faculty_code]))) throw badRequest('ไม่พบคณะที่เลือก')
  if (await queryOne('SELECT 1 FROM app_users WHERE LOWER(email) = $1', [email])) throw badRequest('อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ')

  // role ถูกกำหนดเป็น student ที่ฝั่ง server เสมอ — ส่ง role มาจากฟอร์มก็ไม่มีผล
  const user = await queryOne<{ id: string }>(
    `INSERT INTO app_users (email, password_hash, display_name, faculty_code)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, await hashPassword(password), display_name, faculty_code],
  )
  setSessionCookie(res, signSession({ sub: user!.id, name: display_name, fac: faculty_code, role: 'student' }))
  res.status(201).json({ ok: true })
}))

authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  if (!email || !password) throw badRequest('กรุณากรอกอีเมลและรหัสผ่าน')

  const u = await queryOne<{ id: string; password_hash: string; display_name: string; faculty_code: string; role: Role; is_active: boolean }>(
    `SELECT id, password_hash, display_name, faculty_code, role, is_active
       FROM app_users WHERE LOWER(email) = $1`, [email])

  const ok = await verifyPassword(password, u?.password_hash ?? null)
  // ข้อความเดียวกันทั้งอีเมลผิดและรหัสผิด — ไม่บอกใบ้ว่าอีเมลไหนมีอยู่จริง
  if (!ok || !u) throw unauthorized('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  if (!u.is_active) throw unauthorized('บัญชีนี้ถูกระงับ')

  await query('UPDATE app_users SET last_login_at = NOW() WHERE id = $1', [u.id])
  setSessionCookie(res, signSession({ sub: u.id, name: u.display_name, fac: u.faculty_code, role: u.role }))
  req.log?.info({ userId: u.id, role: u.role }, 'login')
  res.json({ ok: true, role: u.role })
}))

authRouter.post('/logout', (_req, res) => { clearSessionCookie(res); res.json({ ok: true }) })

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const me = await queryOne(
    `SELECT u.id, u.display_name, u.role, f.code AS faculty_code, f.short_th, f.color, f.text_on
       FROM app_users u JOIN faculties f ON f.code = u.faculty_code
      WHERE u.id = $1 AND u.is_active`, [req.user!.sub])
  if (!me) throw unauthorized()
  res.json({ user: me })
}))
