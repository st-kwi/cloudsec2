// api/src/routes/health.routes.ts
// /healthz → ALB target group ใช้ตัวนี้ (ตื้น เร็ว ไม่แตะ DB)
// /readyz  → ตรวจลึกว่าต่อ RDS ได้ ใช้ตอน debug
// ถ้าให้ ALB ใช้ตัวลึก แล้ว RDS สะดุดชั่วคราว ASG จะฆ่าเครื่องที่ยังดีอยู่ทิ้งทั้งกอง
import { Router } from 'express'
import { pingDatabase } from '../db.js'
import { asyncHandler } from '../lib/http.js'

export const healthRouter: Router = Router()
healthRouter.get('/healthz', (_req, res) => { res.json({ status: 'ok', uptime: Math.round(process.uptime()) }) })
healthRouter.get('/readyz', asyncHandler(async (_req, res) => {
  const db = await pingDatabase()
  res.status(db ? 200 : 503).json({ status: db ? 'ready' : 'degraded', database: db })
}))
