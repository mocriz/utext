// src/lib/driveBackup.js
// Backup / restore private key ke Google Drive user (scope drive.file).
// Private key DI-SEAL dulu dengan passphrase (lihat crypto.js) sebelum diupload,
// jadi file di Drive bukan plaintext key.
import { sealPrivateKey, unsealPrivateKey } from './crypto'

const DRIVE_FILE_NAME = 'utext-key.backup.json'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

let tokenClient = null
let accessToken = null

// 1. init GIS (Google Identity Services) — butuh <script> gis.google.com di index.html
function ensureTokenClient() {
  if (tokenClient) return tokenClient
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services belum load — cek index.html')
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (resp) => {
      if (resp.error) throw new Error(resp.error)
      accessToken = resp.access_token
    },
  })
  return tokenClient
}

// 2. minta consent 1x (user klik "Izinkan")
export async function authorizeDrive() {
  ensureTokenClient()
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error))
      accessToken = resp.access_token
      resolve(resp.access_token)
    }
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

// 3. backup (auto-silent) — seal dulu baru upload
export async function backupPrivateKey(privateKeyB64, passphrase) {
  if (!accessToken) await authorizeDrive()
  const envelope = await sealPrivateKey(privateKeyB64, passphrase)
  const body = new Blob([JSON.stringify(envelope)], { type: 'application/json' })

  // cari file lama, update kalau ada, else create
  const find = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const found = await find.json()
  const method = found.files?.length ? 'PATCH' : 'POST'
  const url =
    method === 'PATCH'
      ? `https://www.googleapis.com/drive/v3/files/${found.files[0].id}?uploadType=media`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=media`

  const meta =
    method === 'POST'
      ? { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] }) }
      : null
  // two-step: metadata (POST) lalu media (PATCH). Sederhanakan: pakai multipart.
  const form = new FormData()
  if (method === 'POST') form.append('metadata', new Blob([JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }))
  form.append('file', body)
  const res = await fetch(
    method === 'POST'
      ? 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
      : `https://www.googleapis.com/upload/drive/v3/files/${found.files[0].id}?uploadType=multipart`,
    { method, headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  )
  if (!res.ok) throw new Error('Drive upload gagal: ' + res.status)
  return true
}

// 4. restore — download + unseal pakai passphrase
export async function restorePrivateKey(passphrase) {
  if (!accessToken) await authorizeDrive()
  const find = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const found = await find.json()
  if (!found.files?.length) throw new Error('Backup tidak ditemukan di Drive')
  const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${found.files[0].id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!dl.ok) throw new Error('Download gagal: ' + dl.status)
  const envelope = await dl.json()
  return await unsealPrivateKey(envelope, passphrase)
}
