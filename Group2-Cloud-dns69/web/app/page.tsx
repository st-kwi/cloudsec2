'use client'
import { useCallback, useEffect, useState } from 'react'
import MatchCard from '@/components/MatchCard'
import { useToast } from '@/components/Toast'
import { api, fmtLeft, fmtTime, type Match } from '@/lib/api'

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [offset, setOffset] = useState(0)          // นาฬิกา server − นาฬิกาเครื่อง
  const [now, setNow] = useState(Date.now())
  const [loggedIn, setLoggedIn] = useState(false)
  const [err, setErr] = useState('')
  const toast = useToast()

  const load = useCallback(async () => {
    try {
      const r = await api<{ matches: Match[]; server_now: string }>('/matches')
      setOffset(new Date(r.server_now).getTime() - Date.now())
      setMatches(r.matches); setErr('')
    } catch { setErr('โหลดรายการแมตช์ไม่สำเร็จ ลองรีเฟรชอีกครั้ง') }
  }, [])

  useEffect(() => {
    load()
    api('/auth/me').then(() => setLoggedIn(true)).catch(() => setLoggedIn(false))
  }, [load])

  // นับถอยหลังด้วยเวลาของ server ไม่ใช่ของเครื่องผู้ใช้
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000)
    return () => clearInterval(t)
  }, [offset])

  if (err) return <div className="empty">{err}</div>
  if (!matches) return <div className="empty">กำลังโหลด…</div>

  const next = matches.filter((m) => m.status === 'open' && new Date(m.kickoff_at).getTime() > now)
    .sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at))[0]

  return (
    <>
      {next && (
        <section className="hero" aria-live="polite">
          <h2>แมตช์ถัดไป — ปิดรับคำทายเมื่อเริ่มเตะ</h2>
          <div className="faceoff">
            <div className="side" style={{ background: next.home.color, color: next.home.text_on }}>
              <span className="fac">{next.home.short}</span><span className="full">{next.home.name}</span>
            </div>
            <div className="led">
              <div className="t">{fmtLeft(new Date(next.kickoff_at).getTime() - now)}</div>
              <div className="l">{fmtTime(next.kickoff_at)}</div>
            </div>
            <div className="side right" style={{ background: next.away.color, color: next.away.text_on }}>
              <span className="fac">{next.away.short}</span><span className="full">{next.away.name}</span>
            </div>
          </div>
        </section>
      )}
      <div className="list">
        {matches.length === 0 && <div className="empty">ยังไม่มีแมตช์ แอดมินเพิ่มได้ที่หน้า “จัดการแมตช์”</div>}
        {matches.map((m) => (
          <MatchCard key={`${m.id}-${m.my_home}-${m.my_away}-${m.status}`} m={m} now={now} loggedIn={loggedIn}
            onSaved={(msg, bad) => { toast.show(msg, bad); load() }} onStale={load} />
        ))}
      </div>
      <p className="rules">ทายสกอร์ตรงเป๊ะ +10 · ทายผลแพ้ชนะเสมอถูก +3 · ผิด 0 — แก้คำทายได้จนถึงเวลาเริ่มเตะ</p>
      {toast.node}
    </>
  )
}
