// src/lib/auth.js
// Login + identity E2EE. Private key di-cache di localStorage (same-device reload = instant),
// backup/restore ke Drive cuma lewat TOMBOL (user gesture -> popup diizinkan browser).
import { ref } from 'vue'
import { supabase } from './supabase'
import { generateKeypair } from './crypto'
import { backupPrivateKey, restorePrivateKey } from './driveBackup'

let session = { userId: null, privateKey: null, publicKey: null }
export { session }
const LS_PRIV = 'utext_private_key'
export const identityStatus = ref(null) // 'ok' | 'need_restore' | 'new'

function loadCachedKey() { try { return localStorage.getItem(LS_PRIV) || null } catch { return null } }
export function cacheKey(k) { try { localStorage.setItem(LS_PRIV, k) } catch {} }
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
    .select('public_key, username, deleted_at, display_name, setup_done')
    .eq('id', user.id)
    .single()

  const meta = user.user_metadata || {}
  const googleName = meta.full_name || meta.name || ''
  const googleAvatar = meta.avatar_url || meta.picture || ''
  const setupDone = !!profile?.setup_done

  // Akun yang pernah di-soft-delete (deleted_at SET atau public_key NULL)
  // -> reset total: hapus membership lama, generate identitas baru (mulai dari nol)
  const needReset = profile?.deleted_at || !profile?.public_key
  if (needReset) {
    const { reset_my_account } = await import('./chat')
    try { await reset_my_account() } catch {}
  }

  // User lama (sudah punya public key, belum pernah dihapus) -> restore identitas
  if (profile?.public_key && !profile.deleted_at) {
    session.publicKey = profile.public_key
    const cached = loadCachedKey()
    if (cached) {
      session.privateKey = cached
      return { status: 'ok', setupDone, googleName, googleAvatar }
    }
    // device baru -> butuh restore dari Drive (via tombol)
    return { status: 'need_restore', setupDone, googleName, googleAvatar }
  }

  // User baru / reset -> generate keypair, simpan public key + username (SEKALI saja)
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
  return { status: 'new', needsBackup: true, setupDone, googleName, googleAvatar }
}

// Tombol "Backup ke Drive" (user gesture -> popup allowed)
export async function backupToDrive() {
  if (!session.privateKey) throw new Error('private key belum siap')
  await backupPrivateKey(session.privateKey)
  await supabase.from('profiles').update({ key_backed_up: true }).eq('id', session.userId)
  return true
}

// Tombol "Restore dari Drive" (user gesture -> popup allowed)
// return privateKey (atau null kalau backup hilang) biar store bisa set session
export async function restoreFromDrive() {
  const key = await restorePrivateKey()
  if (key) { session.privateKey = key; cacheKey(key) }
  return key // string | null
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
  const { data } = await supabase.from('profiles').select('username, display_name, avatar_url, setup_done').eq('id', user.id).single()
  return data
}

export async function updateUsername(username) {
  const user = await getAuthUser()
  if (!user) throw new Error('belum login')
  const { error } = await supabase.from('profiles').update({ username }).eq('id', user.id)
  if (error) throw error
  return true
}

// Cek username masih available (belum dipakai user lain)
export async function isUsernameAvailable(username) {
  const user = await getAuthUser()
  if (!user) return false
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle()
  return !data
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

// Simpan setup awal (username wajib, display/avatar opsional) + tandai setup_done
export async function saveSetup({ username, display_name, avatar_file }) {
  const user = await getAuthUser()
  if (!user) throw new Error('belum login')
  if (avatar_file) {
    await updateAvatar(avatar_file)
  }
  // kalau display_name di-skip, pakai nama Google sebagai default
  const meta = user.user_metadata || {}
  const googleName = meta.full_name || meta.name || ''
  const finalDisplay = (display_name && display_name.trim()) || googleName
  const patch = { username }
  if (finalDisplay) patch.display_name = finalDisplay
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (error) throw error
  // tandai setup selesai
  const { error: e2 } = await supabase.rpc('mark_setup_done')
  if (e2) throw e2
  return true
}

// Soft delete akun: tandai deleted_at (lawan tetap baca chat lama + lihat "Deleted Account"),
// hapus backup Drive + private key lokal -> daftar ulang (auth user baru) = mulai dari nol
export async function softDeleteAccount() {
  const { softDeleteAccount: rpc } = await import('./chat')
  await rpc()
  // hapus backup di Drive biar ga ke-restore ke profil lama
  try { const { deleteDriveBackup } = await import('./driveBackup'); await deleteDriveBackup() } catch {}
  clearKey() // hapus private key lokal
}

export async function logout() {
  clearKey()
  session = { userId: null, privateKey: null, publicKey: null }
  await supabase.auth.signOut()
}
