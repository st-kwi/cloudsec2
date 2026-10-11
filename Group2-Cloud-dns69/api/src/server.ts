// api/src/server.ts — จุดเริ่มของ app tier
// เครื่องนี้อยู่ใน private subnet ไม่มี public IP รับได้เฉพาะจาก security group ของ web tier
import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { pinoHttp } from 'pino-http'

import { loadSecrets, getConfig } from './config.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { attachUser } from './middleware/auth.js'

async function main() {
  await loadSecrets()            // ต้องดึง secret ก่อนอ่าน config
  const cfg = getConfig()

  // import หลัง loadSecrets เพราะ db.ts สร้าง pool ทันทีที่ถูก import
  const { pool } = await import('./db.js')
  const { healthRouter } = await import('./routes/health.routes.js')
  const { authRouter } = await import('./routes/auth.routes.js')
  const { matchesRouter } = await import('./routes/matches.routes.js')
  const { leaderboardRouter } = await import('./routes/leaderboard.routes.js')
  const { adminRouter } = await import('./routes/admin.routes.js')

  const app = express()
  app.set('trust proxy', 1)      // อยู่หลัง ALB — ให้ rate limit เห็น IP จริงของผู้ใช้
  app.disable('x-powered-by')

  // log แบบ JSON → CloudWatch Agent เก็บไปได้ตรง ๆ, ตัด cookie/รหัสผ่านออกจาก log
  app.use(pinoHttp({
    level: cfg.isProd ? 'info' : 'debug',
    redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    autoLogging: { ignore: (req) => req.url === '/healthz' },   // ALB เช็คทุก 30 วิ ไม่ต้อง log
  }))
  app.use(helmet())
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }))
  app.use(attachUser)

  app.use(healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api', matchesRouter)
  app.use('/api', leaderboardRouter)
  app.use('/api/admin', adminRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)

  const server = app.listen(cfg.PORT, () => console.log(`[dns69-api] listening on :${cfg.PORT} (${cfg.NODE_ENV})`))

  // ASG terminate เครื่องด้วย SIGTERM — ปิดให้เรียบร้อย ไม่ทิ้ง request ค้าง
  const shutdown = (sig: string) => {
    console.log(`[dns69-api] ${sig} — shutting down`)
    server.close(async () => { await pool.end(); process.exit(0) })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => { console.error('[dns69-api] start failed:', err); process.exit(1) })
