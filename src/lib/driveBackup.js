// src/lib/driveBackup.js
// Backup / restore RAW private key ke Google Drive user (scope drive.file).
// Keputusan: NO passphrase -> user ga perlu inget apa-apa. File di Drive = trust anchor.
// Private key disimpan sebagai base64 JSON { privateKey }.
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

// Minta consent 1x (user klik Izinkan). Auto-silent setelahnya.
// Ada timeout biar ga hang kalau popup ke-block browser.
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
      tokenClient.requestAccessToken({ prompt: 'consent' })
    } catch (e) {
      clearTimeout(timer)
      reject(e)
    }
  })
}

// Cari file backup lama di appDataFolder
async function findBackupFile() {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const json = await res.json()
  return json.files?.[0]?.id || null
}

// Backup RAW private key (auto-silent)
export async function backupPrivateKey(privateKeyB64) {
  if (!accessToken) await authorizeDrive()
  const body = new Blob([JSON.stringify({ privateKey: privateKeyB64 })], { type: 'application/json' })
  const existingId = await findBackupFile()
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }))
  form.append('file', body)

  const url =
    existingId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  const method = existingId ? 'PATCH' : 'POST'

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  if (!res.ok) throw new Error('Drive upload gagal: ' + res.status)
  return true
}

// Restore RAW private key
export async function restorePrivateKey() {
  if (!accessToken) await authorizeDrive()
  const id = await findBackupFile()
  if (!id) throw new Error('Backup tidak ditemukan di Drive')
  const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!dl.ok) throw new Error('Download gagal: ' + dl.status)
  const json = await dl.json()
  return json.privateKey
}

// Cek apakah sudah pernah ada backup (buat flow "restore vs new" di ganti device)
export async function hasBackup() {
  if (!accessToken) await authorizeDrive()
  return (await findBackupFile()) !== null
}
