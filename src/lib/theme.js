// Tema claro / escuro / igual ao sistema (guardado só neste aparelho)
const KEY = 'itac_theme'
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function getThemePref() {
  try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' }
}
export function applyTheme(pref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && mq?.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d111b' : '#006194')
}
export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref) } catch { /* sem storage */ }
  applyTheme(pref)
}
mq?.addEventListener?.('change', () => { if (getThemePref() === 'system') applyTheme('system') })
