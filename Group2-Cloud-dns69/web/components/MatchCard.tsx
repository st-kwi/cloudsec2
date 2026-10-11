'use client'
import { useState } from 'react'
import { api, ApiError, fmtLeft, fmtTime, type Match, type Team } from '@/lib/api'

function TeamBlock({ t, right }: { t: Team; right?: boolean }) {
  return (
    <div className={`team${right ? ' r' : ''}`}>
      <span className="badge" style={{ background: t.color, color: t.text_on }}>{t.short.slice(0, 2)}</span>
      <div style={{ minWidth: 0 }}><div className="nm">{t.short}</div><div className="sub">{t.name}</div></div>
    </div>
  )
}

type Props = {
  m: Match; now: number; loggedIn: boolean
  onSaved: (msg: string, bad?: boolean) => void; onStale: () => void
}

export default function MatchCard({ m, now, loggedIn, onSaved, onStale }: Props) {
  const saved = m.my_home !== null ? [m.my_home, m.my_away as number] : null
  const [draft, setDraft] = useState<number[]>(saved ?? [0, 0])
  const [busy, setBusy] = useState(false)

  const left = new Date(m.kickoff_at).getTime() - now
  // สถานะจาก server เป็นหลัก นาฬิกาฝั่งเว็บใช้แค่แสดงผลนับถอยหลัง
  const status = m.status === 'open' && left <= 0 ? 'closed' : m.status
  const soon = status === 'open' && left <= 36e5
  const locked = status !== 'open'
  const dirty = !saved || saved[0] !== draft[0] || saved[1] !== draft[1]

  function bump(i: number, d: number) {
    setDraft((cur) => { const n = cur.slice(); n[i] = Math.max(0, Math.min(20, n[i] + d)); return n })
  }

  async function save() {
    if (!loggedIn) { window.location.href = '/login'; return }
    setBusy(true)
    try {
      await api(`/matches/${m.id}/prediction`, { method: 'PUT', body: { home: draft[0], away: draft[1] } })
      onSaved(saved ? 'แก้คำทายแล้ว' : 'บันทึกคำทายแล้ว')
    } catch (e) {
      onSaved(e instanceof ApiError ? e.message : 'บันทึกไม่สำเร็จ', true)
      if (e instanceof ApiError && e.status === 409) onStale()
    } finally { setBusy(false) }
  }

  const stepper = (i: number, t: Team) => (
    <div className="step">
      <button type="button" onClick={() => bump(i, 1)} disabled={locked || draft[i] >= 20} aria-label={`เพิ่มประตู ${t.short}`}>▲</button>
      <span className={`digit${locked && !saved ? ' off' : ''}`}>{locked && !saved ? '–' : locked ? saved![i] : draft[i]}</span>
      <button type="button" onClick={() => bump(i, -1)} disabled={locked || draft[i] <= 0} aria-label={`ลดประตู ${t.short}`}>▼</button>
    </div>
  )

  const pill = status === 'done' ? ['done', 'จบแล้ว'] : status === 'closed' ? ['closed', 'ปิดรับแล้ว รอผล'] : soon ? ['soon', 'ใกล้ปิดรับ'] : ['open', 'เปิดรับคำทาย']

  return (
    <article className="card">
      <div className="card-main">
        <TeamBlock t={m.home} />
        {status === 'done' ? (
          <div className="score"><span className="digit">{m.result_home}</span><span className="dash">–</span><span className="digit">{m.result_away}</span></div>
        ) : (
          <div className="score">{stepper(0, m.home)}<span className="dash">–</span>{stepper(1, m.away)}</div>
        )}
        <TeamBlock t={m.away} right />
      </div>
      <div className="meta">
        <span className={`pill ${pill[0]}`}>{pill[1]}</span>
        <span className="grow">
          {fmtTime(m.kickoff_at)}
          {status === 'open' && <> · ปิดรับใน <span className="num">{fmtLeft(left)}</span></>}
          {' · '}{m.prediction_count} คนทาย
        </span>
        {status === 'done' && (saved
          ? <><span>คุณทาย {saved[0]}–{saved[1]}</span><span className={`earned${m.my_points ? '' : ' zero'}`}>+{m.my_points ?? 0}</span></>
          : <span>คุณไม่ได้ทาย</span>)}
        {status === 'closed' && <span>{saved ? `คุณทาย ${saved[0]}–${saved[1]}` : 'ไม่ได้ทาย'}</span>}
        {status === 'open' && (
          <>
            {saved && <span>บันทึกไว้ {saved[0]}–{saved[1]}</span>}
            <button className="btn" type="button" onClick={save} disabled={busy || (loggedIn && !dirty)}>
              {!loggedIn ? 'เข้าสู่ระบบเพื่อทาย' : busy ? 'กำลังบันทึก…' : saved ? 'แก้คำทาย' : 'บันทึกคำทาย'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}
