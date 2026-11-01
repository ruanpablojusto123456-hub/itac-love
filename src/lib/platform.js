import { Capacitor } from '@capacitor/core'

export const isNative = () => Capacitor.isNativePlatform()
export const platformName = () => (Capacitor.getPlatform() === 'android' ? 'android' : 'web')
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

// "1.2.0" > "1.1.9"
export function isNewer(latest, current = APP_VERSION) {
  const a = String(latest || '0').split('.').map(Number), b = String(current).split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true
    if ((a[i] || 0) < (b[i] || 0)) return false
  }
  return false
}
