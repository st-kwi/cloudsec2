'use client'
import Link from 'next/link'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

export default function LoginPage() {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      await api('/auth/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } })
      const next = new URLSearchParams(window.location.search).get('next')
      // อนุญาตเฉพาะ path ภายในเว็บ กัน open redirect ไปเว็บอื่น
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'เข้าสู่ระบบไม่สำเร็จ'); setBusy(false)
    }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>เข้าสู่ระบบ</h1>
      {err && <p className="err" role="alert">{err}</p>}
      <label htmlFor="email">อีเมล</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="password">รหัสผ่าน</label>
      <input id="password" name="password" type="password" required autoComplete="current-password" />
      <button className="btn full" type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
      <p className="alt">ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link></p>
    </form>
  )
}
