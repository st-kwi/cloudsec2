import type { NextConfig } from 'next'

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000'

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",          // เบราว์เซอร์คุยได้แค่โดเมนตัวเอง — app tier ไม่ถูกเปิดออกเน็ต
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // build ออกมาเป็นโฟลเดอร์เล็กที่รันบน EC2 ได้โดยไม่ต้องลง node_modules ทั้งก้อน
  output: 'standalone',

  // web tier เป็นตัวกลางส่ง /api/* ไปให้ app tier ผ่าน internal ALB
  // เบราว์เซอร์ไม่เคยรู้ที่อยู่ของ app tier → app tier อยู่ private subnet ได้ 100%
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }]
  },

  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        // เปิดเมื่อมี ACM certificate บน ALB แล้ว: บังคับ HTTPS 1 ปี
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }]
  },
}
export default nextConfig
