// api/src/lib/http.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message) }
}
export const badRequest   = (m: string) => new ApiError(400, m, 'BAD_REQUEST')
export const unauthorized = (m = 'กรุณาเข้าสู่ระบบ') => new ApiError(401, m, 'UNAUTHORIZED')
export const forbidden    = (m = 'ไม่มีสิทธิ์เข้าถึง') => new ApiError(403, m, 'FORBIDDEN')
export const notFound     = (m = 'ไม่พบข้อมูล') => new ApiError(404, m, 'NOT_FOUND')
export const conflict     = (m: string) => new ApiError(409, m, 'CONFLICT')

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => { fn(req, res, next).catch(next) }
}
