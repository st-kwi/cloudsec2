// api/src/config.ts — อ่านและตรวจ config ทุกตัวที่จุดเดียว ขาดอะไรให้ตายตอน start
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร'),
  SECRETS_MANAGER_SECRET_ID: z.string().optional(),
  AWS_REGION: z.string().default('ap-southeast-1'),
})

/**
 * บน EC2: ดึงรหัสผ่าน DB และ JWT secret จาก Secrets Manager
 * EC2 ได้สิทธิ์ผ่าน IAM role ที่ผูกกับเครื่อง — ไม่มี access key อยู่บนดิสก์
 * ตอนรันบนเครื่องตัวเอง (ไม่ได้ตั้ง SECRETS_MANAGER_SECRET_ID) จะข้ามขั้นนี้
 */
export async function loadSecrets(): Promise<void> {
  const id = process.env.SECRETS_MANAGER_SECRET_ID
  if (!id) return
  const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'ap-southeast-1' })
  const res = await client.send(new GetSecretValueCommand({ SecretId: id }))
  if (!res.SecretString) throw new Error('Secrets Manager ส่งค่าว่างกลับมา')
  const s = JSON.parse(res.SecretString) as Record<string, string>
  if (s.password)   process.env.DB_PASSWORD = s.password
  if (s.username)   process.env.DB_USER = s.username
  if (s.host)       process.env.DB_HOST = s.host
  if (s.port)       process.env.DB_PORT = String(s.port)
  if (s.dbname)     process.env.DB_NAME = s.dbname
  if (s.jwt_secret) process.env.JWT_SECRET = s.jwt_secret
}

export type Config = z.infer<typeof schema> & { isProd: boolean; dbSsl: boolean }
let cached: Config | null = null
export function getConfig(): Config {
  if (cached) return cached
  const p = schema.safeParse(process.env)
  if (!p.success) {
    throw new Error('ค่า config ไม่ถูกต้อง:\n' +
      p.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'))
  }
  cached = { ...p.data, isProd: p.data.NODE_ENV === 'production', dbSsl: p.data.DB_SSL === 'true' }
  return cached
}
