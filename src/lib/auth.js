// src/lib/auth.js
// Login + identity E2EE. Private key di-cache di localStorage (same-device reload = instant),
// backup/restore ke Drive cuma lewat TOMBOL (user gesture -> popup diizinkan browser).
import { ref } from 'vue'
import { supabase } from './supabase'
import { generateKeypair } from './crypto'
import { backupPrivateKey, restorePrivateKey } from './driveBackup'

let session = { userId: null, privateKey: null, publicKey: null }
const LS_PRIV = 'utext_private_key'
export const identityStatus = ref(null) // 'ok' | 'need_restore' | 'new'

function loadCachedKey() { try { return localStorage.getItem(LS_PRIV) || null } catch { return null } }
function cacheKey(k) { try { localStorage.setItem(LS_PRIV, k) } catch {} }
function clearKey() { try { localStorage.removeItem(LS_PRIV) } catch {} }

export function getSession() { return session }

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function getAuthUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

// Dipanggil SEKALI pas login. GA membuka popup (biar ga di-block browser).
export async function ensureIdentity() {
  const user = await getAuthUser()
  if (!user) throw new Error('belum login')
  session.userId = user.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('public_key, username, key_backed_up')
    .eq('id', user.id)
    .single()

  // User lama (sudah punya public key) -> restore identitas, JANGAN ubah username
  if (profile?.public_key) {
    session.publicKey = profile.public_key
    const cached = loadCachedKey()
    if (cached) {
      session.privateKey = cached
      return { status: 'ok' }
    }
    // device baru -> butuh restore dari Drive (via tombol)
    return { status: 'need_restore' }
  }

  // User baru -> generate keypair, simpan public key + username (SEKALI saja)
  // username TIDAK di-overwrite kalau sudah ada (biar edit username bertahan)
  const kp = await generateKeypair()
  session.privateKey = kp.privateKey
  session.publicKey = kp.publicKey
  cacheKey(kp.privateKey)
  const patch = { public_key: kp.publicKey }
  if (!profile?.username) patch.username = await generateUniqueUsername()
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
  if (error) throw error
  return { status: 'new', needsBackup: true }
}

// Tombol "Backup ke Drive" (user gesture -> popup allowed)
export async function backupToDrive() {
  if (!session.privateKey) throw new Error('private key belum siap')
  await backupPrivateKey(session.privateKey)
  await supabase.from('profiles').update({ key_backed_up: true }).eq('id', session.userId)
  return true
}

// Tombol "Restore dari Drive" (user gesture -> popup allowed)
export async function restoreFromDrive() {
  const key = await restorePrivateKey()
  session.privateKey = key
  cacheKey(key)
  return true
}

async function generateUniqueUsername() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36])
      .join('')
    const username = 'user_' + rand
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (!data) return username
  }
  throw new Error('gagal generate username unik')
}

export async function getMyProfile() {
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('username, display_name, avatar_url').eq('id', user.id).single()
  return data
}

export async function updateUsername(username) {
  const user = await getAuthUser()
  if (!user) throw new Error('belum login')
  const { error } = await supabase.from('profiles').update({ username }).eq('id', user.id)
  if (error) throw error
  return true
}

export async function updateDisplayName(name) {
  const { updateDisplayName: rpc } = await import('./chat')
  await rpc(name)
}

export async function updateAvatar(file) {
  const { uploadAvatar } = await import('./chat')
  const url = await uploadAvatar(file)
  const user = await getAuthUser()
  if (!user) throw new Error('belum login')
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
  if (error) throw error
  return url
}

// Soft delete akun: tandai deleted_at (chat lawan tetap bisa dibaca), auth user TIDAK dihapus
export async function softDeleteAccount() {
  const { soft_delete_account } = await import('./chat')
  await soft_delete_account()
}

export async function logout() {
  clearKey()
  session = { userId: null, privateKey: null, publicKey: null }
  await supabase.auth.signOut()
}
