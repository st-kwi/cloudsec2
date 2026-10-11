'use client'
import { useCallback, useRef, useState } from 'react'

export function useToast() {
  const [t, setT] = useState<{ msg: string; bad?: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((msg: string, bad?: boolean) => {
    setT({ msg, bad })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setT(null), 2600)
  }, [])
  const node = <div className={`toast${t ? ' show' : ''}${t?.bad ? ' bad' : ''}`} role="status">{t?.msg}</div>
  return { show, node }
}
