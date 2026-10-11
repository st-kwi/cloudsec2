// api/src/middleware/error.ts — ผู้ใช้ได้ข้อความที่เข้าใจได้ รายละเอียดภายในไปอยู่ใน log
import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../lib/http.js'
import { getConfig } from '../config.js'

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'ไม่พบ endpoint ที่เรียก' })
}
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) { res.status(err.status).json({ error: err.message, code: err.code }); return }
  req.log?.error({ err, path: req.path }, 'unhandled error')
  res.status(500).json({
    error: 'เกิดข้อผิดพลาดภายในระบบ',
    ...(getConfig().isProd ? {} : { detail: String(err) }),
  })
}
