// api/src/middleware/auth.ts — ด่านตรวจสิทธิ์ของทั้งระบบ
// role อ่านจาก JWT ที่เซ็นด้วย server secret เท่านั้น ผู้ใช้ปลอมไม่ได้
import type { Request, Response, NextFunction } from 'express'
import { SESSION_COOKIE, verifySession, type Session, type Role } from '../lib/jwt.js'
import { unauthorized, forbidden } from '../lib/http.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: Session } }
}

/** อ่าน session ถ้ามี ไม่บังคับ — guest ดูรายการแมตช์กับอันดับได้ */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const t = req.cookies?.[SESSION_COOKIE]
  if (t) { try { req.user = verifySession(t) } catch { /* หมดอายุ/ถูกแก้ = guest */ } }
  next()
}
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized())
  next()
}
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) return next(forbidden())
    next()
  }
}
