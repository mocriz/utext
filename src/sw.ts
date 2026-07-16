/// <reference lib="webworker" />
// src/sw.ts — custom service worker (di-build vite-plugin-pwa injectManifest)
// Precache list di-inject otomatis; di sini kita handle push + notification click.

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] }

// precache otomatis (vite-plugin-pwa inject)
import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST || [])

// --- PUSH: tampilin notifikasi saat app tertutup ---
self.addEventListener('push', (event: PushEvent) => {
  let payload: any = { title: 'uText', body: 'Pesan baru' }
  try {
    if (event.data) payload = event.data.json()
  } catch {}
  const title = payload.title || 'uText'
  const options: NotificationOptions = {
    body: payload.body || 'Pesan baru',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'utext',
    data: payload.data || {},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// --- klik notifikasi -> buka app ---
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          (c as any).focus()
          if ('navigate' in c) (c as any).navigate(target)
          return
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
