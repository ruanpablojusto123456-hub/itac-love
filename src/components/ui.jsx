import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, BadgeCheck, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import { isDemo } from '../lib/api'

export function Logo({ className = 'w-56' }) {
  return <img src={logo} alt="ITAC LOVE" className={`${className} select-none drop-shadow-sm`} draggable={false} />
}

const VARIANTS = {
  love: 'bg-secondary text-white shadow-lg shadow-secondary/25 hover:bg-secondary-container',
  ocean: 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-container',
  soft: 'bg-surface-low text-ink hover:bg-surface-mid',
  outline: 'border-2 border-ink-line text-ink hover:bg-surface-low bg-card',
  danger: 'bg-card border-2 border-secondary/30 text-secondary hover:bg-secondary-fixed/40',
  green: 'bg-tertiary text-white hover:bg-tertiary-container shadow-lg shadow-tertiary/20',
}
export function Button({ variant = 'love', loading, className = '', children, ...p }) {
  return (
    <button {...p} disabled={p.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-display font-semibold text-[16px] transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}>
      {loading && <Loader2 className="w-5 h-5 animate-spin" />}{children}
    </button>
  )
}

export function Chip({ active, onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`px-4 py-2 rounded-full text-[14px] font-semibold border transition ${active ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-card text-ink border-ink-line/60 hover:border-primary/50'} ${className}`}>
      {children}
    </button>
  )
}

export function Card({ className = '', children }) {
  return <div className={`bg-card rounded-2xl shadow-[0_4px_20px_-4px_rgba(19,27,46,.08)] ${className}`}>{children}</div>
}

export function ErrorBox({ children }) {
  if (!children) return null
  return <div role="alert" className="rounded-xl bg-secondary-fixed/60 text-secondary px-4 py-3 text-[14px] font-semibold">{children}</div>
}

// Carregando… e, se demorar ou der erro, mostra o motivo e um botão para tentar de novo
export function Spinner({ label, error, onRetry }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(t) }, [])
  const retry = onRetry || (() => window.location.reload())
  if (error || slow) return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center text-ink-soft">
      <p className="font-semibold">{error ? 'Não foi possível carregar.' : 'Está demorando mais que o normal.'}</p>
      <p className="text-[13px]">{error ? String(error.message || error) : 'Verifique sua internet e tente de novo.'}</p>
      <button onClick={retry} className="inline-flex items-center gap-2 rounded-full bg-primary text-white font-semibold px-5 py-2.5"><RefreshCw className="w-4 h-4" />Tentar de novo</button>
    </div>
  )
  return <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-mute"><Loader2 className="w-8 h-8 animate-spin text-primary" />{label}</div>
}

export function VerifiedBadge({ className = '' }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-tertiary-fixed/50 text-tertiary px-2.5 py-1 text-[12px] font-bold ${className}`}><BadgeCheck className="w-4 h-4" />Verificado</span>
}

export function DemoBanner() {
  if (!isDemo) return null
  return <div className="bg-violet text-white text-center text-[12px] font-semibold py-1.5 px-3">Modo demonstração — os dados ficam só neste navegador</div>
}

// Cabeçalho das etapas de cadastro com barra de progresso
export function StepHeader({ step, total = 4, title, subtitle, back }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur border-b border-surface-highest">
      <div className="max-w-xl mx-auto px-4 pt-3 pb-3">
        <div className="flex items-center gap-2">
          {back ? <button onClick={() => nav(back)} aria-label="Voltar" className="p-2 -ml-2 rounded-full hover:bg-surface-low"><ArrowLeft className="w-6 h-6" /></button> : <span className="w-10" />}
          <div className="flex-1 text-center">
            <div className="font-display font-bold text-[18px] leading-tight">{title}</div>
            <div className="text-[12px] font-bold text-primary tracking-wide">ITAC LOVE</div>
          </div>
          <span className="w-10" />
        </div>
        <div className="flex items-center justify-between mt-3 text-[12px]">
          <span className="font-bold text-primary uppercase tracking-wide">Etapa {step} de {total}</span>
          <span className="text-ink-soft">{subtitle}</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-surface-highest overflow-hidden">
          <div className="h-full bg-secondary rounded-full transition-all duration-500" style={{ width: `${(step / total) * 100}%` }} />
        </div>
      </div>
    </header>
  )
}

export function BottomBar({ children }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 bg-gradient-to-t from-surface via-surface to-surface/0 pt-6 safe-bottom">
      <div className="max-w-xl mx-auto px-4">{children}</div>
    </div>
  )
}
