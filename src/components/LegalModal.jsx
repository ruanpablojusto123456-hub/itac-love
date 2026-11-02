import { X } from 'lucide-react'
import { TermsContent } from '../legal/Terms'
import { PrivacyContent } from '../legal/Privacy'

export default function LegalModal({ which, onClose }) {
  if (!which) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-2xl max-h-[88vh] rounded-t-3xl sm:rounded-3xl flex flex-col animate-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-highest">
          <h2 className="font-display font-bold text-[20px]">{which === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-full hover:bg-surface-low"><X className="w-6 h-6" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{which === 'termos' ? <TermsContent /> : <PrivacyContent />}</div>
        <div className="p-4 border-t border-surface-highest"><button onClick={onClose} className="w-full rounded-full bg-primary text-white font-display font-semibold py-3">Entendi</button></div>
      </div>
    </div>
  )
}
