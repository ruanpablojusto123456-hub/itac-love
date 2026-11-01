// Marca d'água discreta com nome e ID de quem está vendo: qualquer print identifica o autor.
export default function Watermark({ name, id, className = '' }) {
  const label = `${name || ''} · ID ${String(id || '').slice(0, 8)}`
  return (
    <div aria-hidden className={`pointer-events-none select-none absolute inset-0 overflow-hidden z-10 ${className}`}>
      <div className="absolute -inset-1/2 flex flex-wrap content-start gap-x-16 gap-y-14 rotate-[-24deg] opacity-[0.07] text-ink font-bold text-[13px]">
        {Array.from({ length: 160 }, (_, i) => <span key={i} className="whitespace-nowrap">{label}</span>)}
      </div>
    </div>
  )
}
