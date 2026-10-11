'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, ApiError, type Faculty } from '@/lib/api'

export default function RegisterPage() {
  const [facs, setFacs] = useState<Faculty[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api<{ faculties: Faculty[] }>('/faculties').then((r) => setFacs(r.faculties)).catch(() => {}) }, [])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); setBusy(true)
    const fd = new FormData(e.currentTarget)
    try {
      await api('/auth/register', { method: 'POST', body: {
        email: fd.get('email'), password: fd.get('password'),
        display_name: fd.get('display_name'), faculty_code: fd.get('faculty_code'),
      } })
      window.location.href = '/'
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'สมัครไม่สำเร็จ'); setBusy(false)
    }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>สมัครสมาชิก</h1>
      {err && <p className="err" role="alert">{err}</p>}
      <label htmlFor="display_name">ชื่อที่แสดงในอันดับ</label>
      <input id="display_name" name="display_name" required maxLength={40} autoComplete="nickname" />
      <label htmlFor="faculty_code">คณะ</label>
      <select id="faculty_code" name="faculty_code" required defaultValue="">
        <option value="" disabled>เลือกคณะ</option>
        {facs.map((f) => <option key={f.code} value={f.code}>{f.name_th}</option>)}
      </select>
      <label htmlFor="email">อีเมล</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="password">รหัสผ่าน (อย่างน้อย 8 ตัว)</label>
      <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      <button className="btn full" type="submit" disabled={busy}>{busy ? 'กำลังสมัคร…' : 'สมัครและเริ่มทายผล'}</button>
      <p className="alt">มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link></p>
    </form>
  )
}
