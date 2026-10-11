'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, fmtTime } from '@/lib/api'

type Row = {
  match_id: number; kickoff_at: string; result_home: number | null; result_away: number | null
  home_short: string; home_color: string; away_short: string; away_color: string
  pred_home: number; pred_away: number; points: number | null
}

export default function MinePage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  useEffect(() => { api<{ predictions: Row[] }>('/predictions/mine').then((r) => setRows(r.predictions)).catch(() => setRows([])) }, [])

  if (!rows) return <div className="empty">กำลังโหลด…</div>
  if (!rows.length) return <div className="empty">ยังไม่ได้ทายแมตช์ไหน <Link href="/">ไปเลือกแมตช์</Link></div>
  const total = rows.reduce((s, r) => s + (r.points ?? 0), 0)

  return (
    <section className="panel">
      <h3>คะแนนรวม {total} แต้ม</h3>
      {rows.map((r) => (
        <div className="row3" key={r.match_id}>
          <div>
            <b><span className="swatch" style={{ background: r.home_color }} /> {r.home_short} – {r.away_short} <span className="swatch" style={{ background: r.away_color }} /></b>
            <div className="sub">{fmtTime(r.kickoff_at)}</div>
          </div>
          <div className="sub">คุณทาย <b className="num">{r.pred_home}–{r.pred_away}</b>
            {r.result_home !== null && <> · ผลจริง <b className="num">{r.result_home}–{r.result_away}</b></>}</div>
          <div className={`earned${r.points ? '' : ' zero'}`}>{r.points === null ? 'รอผล' : `+${r.points}`}</div>
        </div>
      ))}
    </section>
  )
}
