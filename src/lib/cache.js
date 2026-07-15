// src/lib/cache.js
// IndexedDB cache untuk chat (ciphertext, E2EE-safe) + draft per conversation.
// Biar buka room instan + bisa dibaca offline. Isi tetap terenkripsi (butuh private key).
import { openDB } from 'idb'

const DB_NAME = 'utext-cache'
const DB_VER = 1
let _db = null

async function db() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VER, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('messages')) {
        const s = d.createObjectStore('messages', { keyPath: 'id' })
        s.createIndex('conv', 'conversationId')
      }
      if (!d.objectStoreNames.contains('drafts')) {
        d.createObjectStore('drafts') // keyPath = conversationId
      }
    },
  })
  return _db
}

// ---- messages (ciphertext) ----
export async function cacheMessages(conversationId, rows) {
  const d = await db()
  const tx = d.transaction('messages', 'readwrite')
  for (const r of rows) {
    await tx.store.put({ ...r, conversationId })
  }
  await tx.done
}

export async function getCachedMessages(conversationId) {
  const d = await db()
  const all = await d.getAllFromIndex('messages', 'conv', conversationId)
  return all.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export async function cacheMessage(row) {
  const d = await db()
  await d.put('messages', { ...row, conversationId: row.conversationId })
}

export async function deleteCachedMessage(id) {
  const d = await db()
  await d.delete('messages', id)
}

export async function clearConvCache(conversationId) {
  const d = await db()
  const all = await d.getAllFromIndex('messages', 'conv', conversationId)
  const tx = d.transaction('messages', 'readwrite')
  for (const r of all) await tx.store.delete(r.id)
  await tx.done
}

// ---- drafts per conversation (persistent) ----
export async function saveDraft(conversationId, text) {
  const d = await db()
  if (text && text.length) await d.put('drafts', text, conversationId)
  else await d.delete('drafts', conversationId)
}

export async function getDraft(conversationId) {
  const d = await db()
  return (await d.get('drafts', conversationId)) || ''
}

// hapus semua cache pesan (reset akun)
export async function clearAllCache() {
  const d = await db()
  const all = await d.getAll('messages')
  const tx = d.transaction('messages', 'readwrite')
  for (const r of all) await tx.store.delete(r.id)
  await tx.done
}
