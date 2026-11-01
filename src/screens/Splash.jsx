import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Logo } from '../components/ui'
import { homeFor, useSession } from '../lib/session'

export default function Splash() {
  const s = useSession()
  const [done, setDone] = useState(false)
  useEffect(() => { const t = setTimeout(() => setDone(true), 1300); return () => clearTimeout(t) }, [])
  if (done && !s.loading) return <Navigate to={homeFor(s)} replace />
  return (
    <div className="min-h-[calc(100vh-28px)] flex flex-col items-center justify-center bg-gradient-to-b from-surface to-primary-fixed/50 px-6">
      <div className="animate-pop"><Logo className="w-72 animate-floaty" /></div>
      <p className="mt-6 font-display text-[18px] text-ink-soft">Conexões reais e seguras</p>
      <div className="mt-10 flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="w-2.5 h-2.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />)}</div>
    </div>
  )
}
