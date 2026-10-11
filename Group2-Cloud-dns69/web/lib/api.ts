// web/lib/api.ts — ทุกคำขอไปที่ /api ของโดเมนตัวเอง แล้ว Next.js ส่งต่อให้ app tier
// เบราว์เซอร์ไม่มี credential ของฐานข้อมูลเลย session อยู่ใน cookie HttpOnly

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'เกิดข้อผิดพลาด')
  return data as T
}

export type Team = { code: string; short: string; name: string; color: string; text_on: string }
export type Match = {
  id: number; kickoff_at: string; status: 'open' | 'closed' | 'done'
  result_home: number | null; result_away: number | null
  home: Team; away: Team; prediction_count: number
  my_home: number | null; my_away: number | null; my_points: number | null
}
export type Me = { id: string; display_name: string; role: 'student' | 'admin'; faculty_code: string; short_th: string; color: string; text_on: string }
export type Faculty = { code: string; name_th: string; short_th: string; color: string; text_on: string }

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export function fmtLeft(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const D = 864e5, H = 36e5, M = 6e4
  const d = Math.floor(ms / D), h = Math.floor((ms % D) / H), m = Math.floor((ms % H) / M), s = Math.floor((ms % M) / 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return d > 0 ? `${d} วัน ${p(h)}:${p(m)}` : `${p(h)}:${p(m)}:${p(s)}`
}
