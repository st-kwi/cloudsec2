'use client'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/Toast'
import { api, ApiError, fmtTime, type Faculty, type Match } from '@/lib/api'

type Log = { id: number; action: string; entity_id: string; detail: Record<string, unknown> | null; created_at: string; actor: string | null }
const ACTION: Record<string, string> = { 'match.create': 'เพิ่มแมตช์', 'match.close': 'ปิดรับคำทาย', 'match.settle': 'ยืนยันผล' }

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [facs, setFacs] = useState<Faculty[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [score, setScore] = useState<Record<number, [string, string]>>({})
  const toast = useToast()

  const load = useCallback(async () => {
    const [m, a] = await Promise.all([
      api<{ matches: Match[] }>('/matches'),
      api<{ logs: Log[] }>('/admin/audit').catch(() => ({ logs: [] })),
    ])
    setMatches(m.matches.filter((x) => x.status !== 'done')); setLogs(a.logs)
  }, [])

  useEffect(() => {
    load(); api<{ faculties: Faculty[] }>('/faculties').then((r) => setFacs(r.faculties))
  }, [load])

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.show(ok); await load() }
    catch (e) { toast.show(e instanceof ApiError ? e.message : 'ทำรายการไม่สำเร็จ', true) }
  }

  async function addMatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const local = String(fd.get('kickoff') ?? '')
    await run(() => api('/admin/matches', { method: 'POST', body: {
      home_code: fd.get('home'), away_code: fd.get('away'),
      kickoff_at: local ? new Date(local).toISOString() : '',   // แปลงเวลาไทยเป็น UTC ก่อนส่ง
    } }), 'เพิ่มแมตช์แล้ว')
  }

  return (
    <div className="adm">
      <section className="card">
        {matches.length === 0 && <div className="empty">ไม่มีแมตช์ที่รอผล</div>}
        {matches.map((m) => {
          const [h, a] = score[m.id] ?? ['0', '0']
          const set = (i: 0 | 1, v: string) => setScore((s) => { const c: [string, string] = [...(s[m.id] ?? ['0', '0'])] as [string, string]; c[i] = v; return { ...s, [m.id]: c } })
          return (
            <div className="adm-row" key={m.id}>
              <div>
                <b>{m.home.short} – {m.away.short}</b>
                <div className="sub">{fmtTime(m.kickoff_at)} · {m.prediction_count} คำทาย · {m.status === 'open' ? 'ยังเปิดรับ' : 'ปิดรับแล้ว'}</div>
              </div>
              <div className="ctrl">
                {m.status === 'open' && (
                  <button className="btn ghost" type="button" onClick={() => run(() => api(`/admin/matches/${m.id}/close`, { method: 'POST' }), 'ปิดรับคำทายแล้ว')}>ปิดรับทันที</button>
                )}
                <input type="number" min={0} max={30} value={h} onChange={(e) => set(0, e.target.value)} aria-label={`ประตู ${m.home.short}`} />
                <span>–</span>
                <input type="number" min={0} max={30} value={a} onChange={(e) => set(1, e.target.value)} aria-label={`ประตู ${m.away.short}`} />
                <button className="btn" type="button" disabled={m.status === 'open'} title={m.status === 'open' ? 'ต้องปิดรับก่อน' : undefined}
                  onClick={() => run(() => api(`/admin/matches/${m.id}/result`, { method: 'POST', body: { home: Number(h), away: Number(a) } }), `บันทึกผล ${m.home.short} ${h}–${a} ${m.away.short} แล้ว`)}>
                  ยืนยันผลและคิดคะแนน
                </button>
              </div>
            </div>
          )
        })}
      </section>
      <p className="note">ต้องปิดรับก่อนจึงกรอกผลได้ — กันไม่ให้ใครส่งคำทายหลังรู้ผลแล้ว และยืนยันผลซ้ำไม่ได้</p>

      <section className="card">
        <form className="add" onSubmit={addMatch}>
          <label>ทีมเหย้า<select name="home" required>{facs.map((f) => <option key={f.code} value={f.code}>{f.short_th}</option>)}</select></label>
          <label>ทีมเยือน<select name="away" required defaultValue="sci">{facs.map((f) => <option key={f.code} value={f.code}>{f.short_th}</option>)}</select></label>
          <label>เวลาเริ่มเตะ<input type="datetime-local" name="kickoff" required /></label>
          <button className="btn" type="submit">เพิ่มแมตช์</button>
        </form>
      </section>

      <section className="panel">
        <h3>บันทึกการกระทำของผู้ดูแล</h3>
        {logs.length === 0 && <div className="empty">ยังไม่มีรายการ</div>}
        {logs.map((l) => (
          <div className="row3" key={l.id}>
            <div><b>{ACTION[l.action] ?? l.action}</b> <span className="sub">แมตช์ #{l.entity_id}</span></div>
            <div className="sub">{l.actor ?? '—'}{l.detail && 'home' in l.detail ? ` · ผล ${l.detail.home}–${l.detail.away}` : ''}</div>
            <div className="sub">{fmtTime(l.created_at)}</div>
          </div>
        ))}
      </section>
      {toast.node}
    </div>
  )
}
