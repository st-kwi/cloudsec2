'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type P = { id: string; display_name: string; short_th: string; color: string; points: number; exact: number; settled: number }
type F = { code: string; short_th: string; color: string; members: number; avg_points: number }

export default function LeaderboardPage() {
  const [d, setD] = useState<{ players: P[]; faculties: F[] } | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  useEffect(() => {
    api<{ players: P[]; faculties: F[] }>('/leaderboard').then(setD).catch(() => setD({ players: [], faculties: [] }))
    api<{ user: { id: string } }>('/auth/me').then((r) => setMeId(r.user.id)).catch(() => {})
  }, [])
  if (!d) return <div className="empty">กำลังโหลด…</div>

  return (
    <div className="cols">
      <section className="panel">
        <h3>ผู้ทายแม่นที่สุด</h3>
        {d.players.length === 0 && <div className="empty">ยังไม่มีผู้เล่น</div>}
        {d.players.map((p, i) => (
          <div className={`row${p.id === meId ? ' me' : ''}`} key={p.id}>
            <span className="rank">{i + 1}</span>
            <span className="who"><span className="swatch" style={{ background: p.color }} /><span className="n">{p.display_name}</span><small>{p.short_th} · ตรงเป๊ะ {p.exact}</small></span>
            <span className="pts">{p.points}</span>
          </div>
        ))}
      </section>
      <section className="panel">
        <h3>คณะที่ทายแม่นที่สุด</h3>
        {d.faculties.filter((f) => f.members > 0).map((f, i) => (
          <div className="row" key={f.code}>
            <span className="rank">{i + 1}</span>
            <span className="who"><span className="swatch" style={{ background: f.color }} /><span className="n">{f.short_th}</span><small>{f.members} คน</small></span>
            <span className="pts">{f.avg_points.toFixed(1)}</span>
          </div>
        ))}
        <p className="rules">คะแนนเฉลี่ยต่อคน คณะที่คนเยอะจะได้ไม่ได้เปรียบ</p>
      </section>
    </div>
  )
}
