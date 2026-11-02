// Service worker do ITAC LOVE: mostra notificações e abre a conversa ao tocar
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const route = e.notification.data?.route
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const c = all[0]
    if (c) { await c.focus(); if (route) c.postMessage({ route }) }
    else await self.clients.openWindow('./' + (route ? '#' + route : ''))
  })())
})
