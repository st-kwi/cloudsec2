// api/src/db.ts — ประตูเดียวสู่ฐานข้อมูล ทุก query ต้องผ่านที่นี่
import pg from 'pg'
import { getConfig } from './config.js'

const cfg = getConfig()

export const pool = new pg.Pool({
  host: cfg.DB_HOST, port: cfg.DB_PORT, database: cfg.DB_NAME,
  user: cfg.DB_USER, password: cfg.DB_PASSWORD,
  // EC2 2 เครื่องต่อ RDS ตัวเดียว — จำกัดไว้กัน "too many connections" ตอน ASG ขยาย
  max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000,
  ssl: cfg.dbSsl ? { rejectUnauthorized: false } : false,
})
pool.on('error', (err) => console.error('[db] idle client error', err))

/** parameterized query เสมอ — ห้ามต่อ string เข้า SQL */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string, params: unknown[] = [],
): Promise<T[]> {
  return (await pool.query<T>(text, params)).rows
}
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string, params: unknown[] = [],
): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null
}
export async function withTransaction<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect()
  try {
    await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
}
export async function pingDatabase(): Promise<boolean> {
  try { await pool.query('SELECT 1'); return true } catch { return false }
}
