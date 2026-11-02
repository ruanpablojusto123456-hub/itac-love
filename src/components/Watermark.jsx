import { memo, useMemo } from 'react'

// Marca d'água discreta com nome e ID de quem está vendo: qualquer print identifica o autor.
// Desenhada como um único fundo SVG repetido (leve: não cria centenas de elementos na tela).
function Watermark({ name, id, className = '', light = false }) {
  const label = `${name || ''} · ID ${String(id || '').slice(0, 8)}`
  const bg = useMemo(() => {
    const esc = label.replace(/[<>&'"]/g, '')
    const color = light ? 'rgba(255,255,255,0.28)' : 'rgba(128,138,158,0.16)'
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='280' height='150'><text x='20' y='95' transform='rotate(-24 140 75)' font-family='Plus Jakarta Sans,Arial,sans-serif' font-size='13' font-weight='700' fill='${color}'>${esc}</text></svg>`
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
  }, [label, light])
  return <div aria-hidden className={`pointer-events-none select-none absolute inset-0 z-10 ${className}`} style={{ backgroundImage: bg, backgroundRepeat: 'repeat' }} />
}
export default memo(Watermark)
