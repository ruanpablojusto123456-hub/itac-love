import { useEffect, useState } from 'react'
import { api } from '../lib/api'

// Mostra uma foto do Storage (gera URL assinada temporária no modo real)
export default function PhotoImg({ path, selfie, className = '', alt = '', ...p }) {
  const [src, setSrc] = useState(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let on = true
    ;(selfie ? api.selfieUrl(path) : api.photoUrl(path)).then(u => on && setSrc(u))
    return () => { on = false }
  }, [path, selfie])
  if (!src) return <div className={`bg-surface-mid animate-pulse ${className}`} />
  return <img src={src} alt={alt} draggable={false} decoding="async" className={`${className} transition-opacity duration-300`} style={{ opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} {...p} />
}
