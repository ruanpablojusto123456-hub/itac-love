// Notificações do navegador (na web). No APK, o push vem pelo Firebase Cloud Messaging (fase 2).
export const canNotify = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

export async function askNotify() {
  if (typeof Notification === 'undefined') return 'unsupported'
  try { return await Notification.requestPermission() } catch { return 'denied' }
}

export function showNotification(title, body) {
  try {
    if (canNotify() === 'granted') new Notification(title, { body, icon: './icon-192.png' })
  } catch { /* alguns navegadores móveis só permitem via service worker */ }
}
