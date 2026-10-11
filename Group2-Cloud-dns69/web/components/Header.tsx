'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, type Me } from '@/lib/api'

export default function Header() {
  const path = usePathname()
  const [me, setMe] = useState<Me | null | undefined>(undefined)

  useEffect(() => {
    api<{ user: Me }>('/auth/me').then((r) => setMe(r.user)).catch(() => setMe(null))
  }, [path])

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }) } finally { window.location.href = '/' }
  }

  const tabs: [string, string][] = [['/', 'แมตช์'], ['/leaderboard', 'อันดับ']]
  if (me) tabs.splice(1, 0, ['/mine', 'คำทายของฉัน'])
  if (me?.role === 'admin') tabs.push(['/admin', 'จัดการแมตช์'])

  return (
    <>
      <div className="turf">
        <div className="wrap bar">
          <Link href="/" className="brand">DNS69<small>ทายผลฟุตบอลกีฬาสี</small></Link>
          {me === undefined ? null : me ? (
            <>
              <span className="chip">
                <span className="swatch" style={{ background: me.color }} />
                {me.display_name} · {me.short_th}{me.role === 'admin' ? ' · ผู้ดูแล' : ''}
              </span>
              <button className="chip-btn" type="button" onClick={logout}>ออกจากระบบ</button>
            </>
          ) : (
            <>
              <Link className="chip-btn" href="/login">เข้าสู่ระบบ</Link>
              <Link className="chip-btn solid" href="/register">สมัครสมาชิก</Link>
            </>
          )}
        </div>
      </div>
      <nav className="wrap tabs" aria-label="เมนูหลัก">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>
        ))}
      </nav>
    </>
  )
}
