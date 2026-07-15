// src/lib/cache.js
// Local chat cache pakai NATIVE IndexedDB (tanpa dependency) — biar chat instan + offline.
// Menyimpan CIPHERTEXT (E2EE-safe). Key ada di localStorage, jadi isi tetap rahasia.
const DB_NAME = 'utext-cache'
const DB_VER = 1
const STORE_MSG = 'messages'
const STORE_DRAFT = 'drafts'
let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no indexedDB'))
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_MSG)) {
        const s = db.createObjectStore(STORE_MSG, { keyPath: 'id' })
        s.createIndex('conv', 'conversationId')
      }
      if (!db.objectStoreNames.contains(STORE_DRAFT)) {
        db.createObjectStore(STORE_DRAFT) // keyPath = conversationId
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store)
}

// ---- messages (ciphertext) ----
export async function cacheMessages(conversationId, rows) {
  const db = await openDB()
  const store = tx(db, STORE_MSG, 'readwrite')
  for (const r of rows) store.put({ ...r, conversationId })
}

export async function getCachedMessages(conversationId) {
  const db = await openDB()
  return await new Promise((resolve, reject) => {
    const idx = tx(db, STORE_MSG, 'readonly').index('conv')
    const req = idx.getAll(conversationId)
    req.onsuccess = () => {
      const all = req.result || []
      all.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      resolve(all)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function cacheMessage(row) {
  const db = await openDB()
  tx(db, STORE_MSG, 'readwrite').put({ ...row, conversationId: row.conversationId })
}

export async function deleteCachedMessage(id) {
  const db = await openDB()
  tx(db, STORE_MSG, 'readwrite').delete(id)
}

export async function clearConvCache(conversationId) {
  const db = await openDB()
  const idx = tx(db, STORE_MSG, 'readwrite').index('conv')
  const req = idx.getAllKeys(conversationId)
  req.onsuccess = () => {
    const keys = req.result || []
    for (const k of keys) tx(db, STORE_MSG, 'readwrite').delete(k)
  }
}

export async function clearAllCache() {
  const db = await openDB()
  tx(db, STORE_MSG, 'readwrite').clear()
}

// ---- drafts per conversation ----
export async function saveDraft(conversationId, text) {
  const db = await openDB()
  const store = tx(db, STORE_DRAFT, 'readwrite')
  if (text && text.length) store.put(text, conversationId)
  else store.delete(conversationId)
}

export async function getDraft(conversationId) {
  const db = await openDB()
  return await new Promise((resolve, reject) => {
    const req = tx(db, STORE_DRAFT, 'readonly').get(conversationId)
    req.onsuccess = () => resolve(req.result || '')
    req.onerror = () => reject(req.error)
  })
}
