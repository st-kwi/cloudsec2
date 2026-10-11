// api/src/lib/password.ts — bcryptjs (pure JS) ไม่ต้อง compile บน t3.micro
import bcrypt from 'bcryptjs'
const ROUNDS = 12
export const hashPassword = (p: string) => bcrypt.hash(p, ROUNDS)

// ใช้เวลาเท่ากันแม้ไม่มีผู้ใช้ — กันการจับเวลาเพื่อเดาว่าอีเมลไหนมีในระบบ
const DUMMY = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.9jVhqtGZ0mKlFTWpAr7WD8nKqBk5iTm'
export async function verifyPassword(p: string, hash: string | null): Promise<boolean> {
  if (!hash) { await bcrypt.compare(p, DUMMY); return false }
  return bcrypt.compare(p, hash)
}
