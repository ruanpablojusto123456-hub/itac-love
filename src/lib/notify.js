// Notificações do ITAC LOVE
//  1) Dentro do app: aviso no topo da tela (toast) quando chega mensagem de outra conversa.
//  2) App em segundo plano: notificação do sistema (APK: LocalNotifications; web: Notification/Service Worker).
//  3) App fechado: push do Firebase (FCM) — ativado quando o projeto Firebase estiver configurado.
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'

const native = () => Capacitor.isNativePlatform()
const FCM_ENABLED = import.meta.env.VITE_FCM_ENABLED === '1'
let appActive = true
let nextId = 1

export const canNotify = () => (native() ? 'native' : typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

export async function askNotify() {
  try {
    if (native()) {
      const r = await LocalNotifications.requestPermissions()
      return r.display === 'granted' ? 'granted' : 'denied'
    }
    if (typeof Notification === 'undefined') return 'unsupported'
    return await Notification.requestPermission()
  } catch { return 'denied' }
}

export async function notifPermission() {
  try {
    if (native()) return (await LocalNotifications.checkPermissions()).display
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  } catch { return 'denied' }
}

function routeFor(data = {}) {
  if (data.conversation_id) return `/app/conversas/${data.conversation_id}`
  if (data.invite_id) return '/app/convites'
  if (data.match_id) return '/app/conversas'
  return null
}
function openRoute(r) { if (r) window.location.hash = '#' + r }

// Notificação do sistema (aparece na barra do celular / do computador)
export async function showNotification(title, body, data = {}) {
  try {
    if (native()) {
      await LocalNotifications.schedule({ notifications: [{ id: nextId++ % 100000, title, body, extra: data, smallIcon: 'ic_launcher', channelId: 'mensagens' }] })
      return
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) reg.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', data: { route: routeFor(data) }, tag: data.conversation_id || undefined })
    else new Notification(title, { body, icon: './icon-192.png' })
  } catch { /* alguns navegadores bloqueiam */ }
}

// Chamado pelo tempo real a cada notificação nova do usuário
export function handleIncomingNotification(n) {
  if (!n) return
  const route = routeFor(n.data)
  const here = window.location.hash.replace(/^#/, '')
  const visible = native() ? appActive : !document.hidden
  if (visible) {
    if (route && here === route) return // já está nesta conversa
    window.dispatchEvent(new CustomEvent('itac-toast', { detail: { title: n.title, body: n.body, route } }))
  } else {
    showNotification(n.title, n.body || '', n.data || {})
  }
}

// Inicialização (uma vez, ao abrir o app)
export async function initNotifications({ onToken } = {}) {
  if (native()) {
    App.addListener('appStateChange', ({ isActive }) => { appActive = isActive })
    try {
      await LocalNotifications.createChannel({ id: 'mensagens', name: 'Mensagens e matches', importance: 5, visibility: 1, vibration: true })
    } catch { /* Android antigo */ }
    LocalNotifications.addListener('localNotificationActionPerformed', (a) => openRoute(routeFor(a.notification?.extra)))
    if (FCM_ENABLED) {
      try {
        PushNotifications.addListener('registration', (t) => onToken?.(t.value))
        PushNotifications.addListener('pushNotificationActionPerformed', (a) => openRoute(routeFor(a.notification?.data)))
        const p = await PushNotifications.requestPermissions()
        if (p.receive === 'granted') await PushNotifications.register()
      } catch (e) { console.warn('Push indisponível:', e) }
    }
  } else if ('serviceWorker' in navigator && location.protocol === 'https:') {
    try {
      await navigator.serviceWorker.register('./sw.js')
      navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.route) openRoute(e.data.route) })
    } catch { /* sem service worker */ }
  }
}
