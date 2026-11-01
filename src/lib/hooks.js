import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

let tagCache = null
export function useTags() {
  const [tags, setTags] = useState(tagCache || [])
  useEffect(() => { if (!tagCache) api.listTags().then(t => { tagCache = t; setTags(t) }) }, [])
  return tags
}
export const tagLabel = (tags, id) => tags.find(t => t.id === id)?.label || ''

// Carrega dados e recarrega quando algo muda (tempo real / modo demo)
export function useLive(fn, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const fnRef = useRef(fn); fnRef.current = fn
  const load = useCallback(() => fnRef.current().then(d => { setData(d); setError(null) }).catch(setError), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); const off = api.onChange(load); return off }, [load, ...deps])
  return { data, error, reload: load }
}

export function useNow(ms = 1000) {
  const [n, setN] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return n
}

export function formatLeft(ms) {
  if (ms <= 0) return 'expirado'
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1000)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min ${String(s).padStart(2, '0')}s`
}
