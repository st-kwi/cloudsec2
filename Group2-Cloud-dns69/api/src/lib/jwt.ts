// api/src/lib/jwt.ts — session token อยู่ใน cookie แบบ HttpOnly ที่ JavaScript อ่านไม่ได้
import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import { getConfig } from '../config.js'

export const SESSION_COOKIE = 'dns69_session'
export type Role = 'student' | 'admin'
export type Session = { sub: string; name: string; fac: string; role: Role }

export function signSession(p: Session): string {
  return jwt.sign(p, getConfig().JWT_SECRET, { expiresIn: '7d', issuer: 'dns69-api' })
}
export function verifySession(token: string): Session {
  return jwt.verify(token, getConfig().JWT_SECRET, { issuer: 'dns69-api' }) as Session
}
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: getConfig().isProd, sameSite: 'lax', path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: getConfig().isProd, sameSite: 'lax', path: '/' })
}
