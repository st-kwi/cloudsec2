// web/app/healthz/route.ts — ให้ ALB target group ของ web tier ใช้ตรวจว่าเครื่องยังตอบ
export const dynamic = 'force-dynamic'
export function GET() {
  return Response.json({ status: 'ok' })
}
