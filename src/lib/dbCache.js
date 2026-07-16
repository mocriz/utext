// src/lib/dbCache.js
// IndexedDB cache buat offline: pesan (plaintext) + pending outbox queue.
// Pakai lib 'idb' (sudah di deps). Semua akses async, fail-safe (try/catch).
import { openDB } from 'idb'

const DB_NAME = 'utext-cache'
const DB_VERSION = 1
let _db = null

async function db() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('messages')) {
        const s = d.createObjectStore('messages', { keyPath: 'id' })
        s.createIndex('byConv', 'convId')
      }
      if (!d.objectStoreNames.contains('queue')) {
        d.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
    },
  })
  return _db
}

/* ===== MESSAGES (plaintext cache) ===== */

// simpan banyak pesan sekaligus
export async function cacheMessages(convId, msgs) {
  try {
    const d = await db()
    const tx = d.transaction('messages', 'readwrite')
    for (const m of msgs) {
      await tx.store.put({
        id: m.id,
        convId,
        plaintext: m.plaintext,
        senderId: m.senderId,
        createdAt: m.createdAt,
        mediaPath: m.mediaPath || null,
        media_iv: m.media_iv || null,
        reply_to: m.reply_to || null,
        edited_at: m.edited_at || null,
        deleted_for_all: m.deleted_for_all || false,
        deleted_for: m.deleted_for || null,
      })
    }
    await tx.done
  } catch {}
}

// cache 1 pesan (pas kirim / realtime masuk)
export async function cacheMessage(msg) {
  try {
    const d = await db()
    await d.put('messages', {
      id: msg.id,
      convId: msg.convId,
      plaintext: msg.plaintext,
      senderId: msg.senderId,
      createdAt: msg.createdAt,
      mediaPath: msg.mediaPath || null,
      media_iv: msg.media_iv || null,
      reply_to: msg.reply_to || null,
      edited_at: msg.edited_at || null,
      deleted_for_all: msg.deleted_for_all || false,
      deleted_for: msg.deleted_for || null,
    })
  } catch {}
}

// baca cache per conversation (offline read)
export async function getCachedMessages(convId) {
  try {
    const d = await db()
    const all = await d.getAllFromIndex('messages', 'byConv', convId)
    return all
      .filter((m) => !m.deleted_for_all)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((m) => ({
        id: m.id,
        senderId: m.senderId,
        plaintext: m.plaintext,
        createdAt: m.createdAt,
        mediaPath: m.mediaPath,
        media_iv: m.media_iv,
        reply_to: m.reply_to,
        edited_at: m.edited_at,
      }))
  } catch {
    return []
  }
}

export async function deleteCachedMessage(id) {
  try {
    const d = await db()
    await d.delete('messages', id)
  } catch {}
}

/* ===== OUTBOX QUEUE (pending send saat offline) ===== */

// simpan pesan yg gagal terkirim (ciphertext + nonce sudah terenkripsi)
export async function enqueueMessage(item) {
  try {
    const d = await db()
    return await d.add('queue', { ...item, ts: Date.now() })
  } catch {
    return null
  }
}

export async function getQueue() {
  try {
    const d = await db()
    return await d.getAll('queue')
  } catch {
    return []
  }
}

export async function dequeueMessage(id) {
  try {
    const d = await db()
    await d.delete('queue', id)
  } catch {}
}

export async function clearQueue() {
  try {
    const d = await db()
    await d.clear('queue')
  } catch {}
}
