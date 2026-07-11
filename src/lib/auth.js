// src/lib/auth.js
// Flow login: Google OAuth (Supabase) -> keypair -> username random ->
// simpan public key -> backup raw private key ke Drive (auto-silent).
// Atau kalau ganti device: restore private key dari Drive.
import { supabase } from './supabase'
import { generateKeypair } from './crypto'
import { backupPrivateKey, restorePrivateKey } from './driveBackup'

// --- session key disimpan di memory (ga pernah ke DB sebagai plaintext) ---
let session = { userId: null, privateKey: null, publicKey: null }

export function getSession() {
  return session
}

// Login pake Google (Supabase Auth popup)
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

// Setelah login: siapkan identitas E2EE (keypair + username + public key)
export async function ensureIdentity() {
  const user = await getAuthUser()
  if (!user) throw new Error('belum login')
  session.userId = user.id

  // 1. Cek profile lama (udah punya public key?)
  const { data: profile } = await supabase
    .from('profiles')
    .select('public_key, username')
    .eq('id', user.id)
    .single()

  if (profile?.public_key) {
    // user lama -> cek backup di Drive buat restore private key
    try {
      session.privateKey = await restorePrivateKey()
    } catch {
      // backup ga ada / gagal -> generate ulang (chat lama ga bisa dibuka)
      await generateAndStore(user.id)
    }
    session.publicKey = profile.public_key
  } else {
    // user baru -> generate keypair + username random
    await generateAndStore(user.id)
    // auto-backup raw private key ke Drive (silent, butuh consent 1x)
    try {
      await backupPrivateKey(session.privateKey)
      await supabase.from('profiles').update({ key_backed_up: true }).eq('id', user.id)
    } catch (e) {
      // backup gagal (user tolak Drive) -> tetap jalan, ga blocking
      console.warn('backup Drive gagal:', e.message)
    }
  }
  return session
}

async function generateAndStore(userId) {
  const kp = await generateKeypair()
  session.privateKey = kp.privateKey
  session.publicKey = kp.publicKey
  const username = await generateUniqueUsername()
  const { error } = await supabase
    .from('profiles')
    .update({ public_key: kp.publicKey, username })
    .eq('id', userId)
  if (error) throw error
}

// Username random: "user_" + 8 karakter alnum (lowercase, cocok constraint [a-z0-9_])
async function generateUniqueUsername() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36])
      .join('')
    const username = 'user_' + rand
    // cek unik
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (!data) return username
  }
  throw new Error('gagal generate username unik')
}

// Logout
export async function logout() {
  session = { userId: null, privateKey: null, publicKey: null }
  await supabase.auth.signOut()
}
