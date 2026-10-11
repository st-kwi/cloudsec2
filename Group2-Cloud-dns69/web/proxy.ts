// web/proxy.ts — Next.js 16 middleware
// กันหน้าที่ต้องล็อกอิน/ต้องเป็นแอดมิน เพื่อ UX ที่ดี (ไม่ให้เห็นหน้าเปล่า)
// ด่านจริงอยู่ที่ app tier เสมอ — ต่อให้ข้ามตรงนี้ได้ API ก็ตอบ 401/403
import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE = 'dns69_session'
const PROTECTED = ['/mine', '/admin']

async function readRole(token?: string): Promise<string | null> {
  const secret = process.env.JWT_SECRET
  if (!token || !secret) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: 'dns69-api' })
    return String(payload.role ?? '')
  } catch { return null }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const role = await readRole(req.cookies.get(COOKIE)?.value)

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !role) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url))
  }
  if ((pathname === '/login' || pathname === '/register') && role) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
}

// ห้ามให้ middleware ดัก /api — ไม่งั้นคำขอล็อกอินจะโดน redirect ก่อนถึง app tier
export const config = {
  matcher: ['/((?!api|healthz|_next/static|_next/image|favicon.ico).*)'],
}
