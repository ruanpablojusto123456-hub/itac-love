import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function LegalPage({ title, children }) {
  const nav = useNavigate()
  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 bg-surface/90 backdrop-blur border-b border-surface-highest">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Voltar" className="p-2 -ml-2 rounded-full hover:bg-surface-low"><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="font-display font-bold text-[20px]">{title}</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 pt-5">{children}</main>
    </div>
  )
}
