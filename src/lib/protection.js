import { useEffect, useRef, useState } from 'react'
import { isNative } from './platform'

// Proteções contra print.
// APK: FLAG_SECURE (tela preta no print) + evento nativo "itacScreenshot" (Android 14+).
// Web: borra ao perder o foco, detecta Print Screen e atalhos de captura conhecidos.
export function useScreenProtection(onAttempt) {
  const [blurred, setBlurred] = useState(false)
  const cb = useRef(onAttempt); cb.current = onAttempt
  useEffect(() => {
    let t = null
    const flash = () => { setBlurred(true); clearTimeout(t); t = setTimeout(() => setBlurred(document.hidden || !document.hasFocus()), 2500) }
    let last = 0
    const attempt = () => { flash(); if (Date.now() - last > 3000) { last = Date.now(); cb.current?.() } }
    const onKey = (e) => {
      const k = (e.key || '').toLowerCase()
      const mod = e.metaKey || e.ctrlKey
      if (k === 'printscreen' || e.code === 'PrintScreen' ||
          (e.shiftKey && mod && ['s', '3', '4', '5'].includes(k)) ||   // Win+Shift+S, Cmd+Shift+3/4/5
          (e.metaKey && e.shiftKey && k === 's')) {
        e.preventDefault?.(); attempt()
        navigator.clipboard?.writeText(' ').catch(() => {})
      }
    }
    const onBlur = () => setBlurred(true)
    const onFocus = () => setBlurred(false)
    const onVis = () => setBlurred(document.hidden)
    const onNative = () => attempt()
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    if (!isNative()) { window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onVis) }
    window.addEventListener('itacScreenshot', onNative)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true)
      window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('itacScreenshot', onNative)
    }
  }, [])
  return blurred
}

export const blockCopy = {
  onContextMenu: (e) => e.preventDefault(),
  onCopy: (e) => e.preventDefault(),
  onCut: (e) => e.preventDefault(),
  onDragStart: (e) => e.preventDefault(),
}
