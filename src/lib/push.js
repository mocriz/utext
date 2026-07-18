// src/lib/push.js
// Web Push subscription buat notif bot reply (saat app tertutup).
// Butuh VAPID public key (dari Supabase Edge Function env, disimpen di sini).
// CATATAN: iOS PWA gak dukung Web Push. Android/desktop OK.

// Ganti dengan VAPID_PUBLIC_KEY lu (dari Supabase: Settings > Edge Functions > VAPID)
export const VAPID_PUBLIC_KEY = 'BEe_1UMyCIpI0pr1ntzPgsRGdkTwysm96OuTN9CYcmucJAx02VZuoJPTgvFHJ9hazfLCjob5U9E20mRb8VODHwI' // placeholder, ganti!

import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// minta izin + subscribe, simpan ke DB. Return true kalau berhasil.
export async function subscribePush() {
  if (!pushSupported()) return false
  if (Notification.permission === 'denied') return false
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return false
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    // simpan ke DB
    const { error } = await supabase.rpc('save_push_subscription', { sub: sub.toJSON() })
    if (error) throw error
    return true
  } catch (e) {
    console.warn('push subscribe gagal:', e?.message)
    return false
  }
}

export async function unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
  } catch {}
}
