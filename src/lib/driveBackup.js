// src/lib/driveBackup.js
// Backup / restore RAW private key ke Google Drive user (scope drive.file).
// NO passphrase -> user ga perlu inget apa-apa. File di Drive = trust anchor.
// Token di-cache di localStorage -> consent cuma 1x (reuse grant silent setelahnya).
import { supabase } from './supabase'

const DRIVE_FILE_NAME = 'utext-key.backup.json'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

let tokenClient = null
let accessToken = null
const LS_KEY = 'utext_drive_token'

// restore token dari localStorage (biar consent ga muncul tiap refresh)
try { accessToken = localStorage.getItem(LS_KEY) || null } catch {}
function cacheToken(t) {
  accessToken = t
  try { localStorage.setItem(LS_KEY, t) } catch {}
}
function clearToken() { accessToken = null; try { localStorage.removeItem(LS_KEY) } catch {} }

function ensureTokenClient() {
  if (tokenClient) return tokenClient
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services belum load — cek index.html')
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: () => {},
  })
  return tokenClient
}

// Minta token. TANPA prompt:'consent' -> pertama kali otomatis consent,
// setelahnya reuse grant secara silent (ga muncul layar izin lagi).
export async function authorizeDrive() {
  ensureTokenClient()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Drive consent timeout (popup ke-block?)')), 15000)
    tokenClient.callback = (resp) => {
      clearTimeout(timer)
      if (resp.error) return reject(new Error(resp.error))
      cacheToken(resp.access_token)
      resolve(resp.access_token)
    }
    try {
      tokenClient.requestAccessToken() // no prompt -> silent reuse
    } catch (e) {
      clearTimeout(timer)
      reject(e)
    }
  })
}

async function findBackupFile() {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (res.status === 401) throw new Error('UNAUTH')
  const json = await res.json()
  return json.files?.[0]?.id || null
}

// Wrapper: kalau token expired (401) -> re-auth 1x lalu retry
async function authed(fn) {
  if (!accessToken) await authorizeDrive()
  try {
    return await fn()
  } catch (e) {
    if (e.message === 'UNAUTH') {
      clearToken()
      await authorizeDrive()
      return await fn()
    }
    throw e
  }
}

// Backup RAW private key (auto-silent)
export async function backupPrivateKey(privateKeyB64) {
  await authed(async () => {
    const body = new Blob([JSON.stringify({ privateKey: privateKeyB64 })], { type: 'application/json' })
    const existingId = await findBackupFile()
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }))
    form.append('file', body)
    const url = existingId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
    const method = existingId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}` }, body: form })
    if (res.status === 401) throw new Error('UNAUTH')
    if (!res.ok) throw new Error('Drive upload gagal: ' + res.status)
  })
  return true
}

// Restore RAW private key
export async function restorePrivateKey() {
  return await authed(async () => {
    const id = await findBackupFile()
    if (!id) throw new Error('Backup tidak ditemukan di Drive')
    const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (dl.status === 401) throw new Error('UNAUTH')
    if (!dl.ok) throw new Error('Download gagal: ' + dl.status)
    const json = await dl.json()
    return json.privateKey
  })
}

// Cek apakah sudah pernah ada backup
export async function hasBackup() {
  try {
    return (await authed(() => findBackupFile())) !== null
  } catch {
    return false
  }
}
