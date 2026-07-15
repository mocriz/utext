// src/lib/chat.js
// Search user, buat conversation 1-on-1, kirim + terima pesan terenkripsi (realtime).
import { supabase } from './supabase'
import { getSession } from './auth'
import { deriveSharedSecret, encryptText, decryptText, encryptBytes, decryptBytes } from './crypto'

// --- public key partner di-cache biar ga fetch tiap kali ---
const pubKeyCache = new Map()

async function getPartnerPublicKey(userId) {
  if (pubKeyCache.has(userId)) return pubKeyCache.get(userId)
  const { data } = await supabase
    .from('profiles')
    .select('public_key')
    .eq('id', userId)
    .single()
  if (!data?.public_key) throw new Error('partner belum punya public key')
  pubKeyCache.set(userId, data.public_key)
  return data.public_key
}

// shared secret dengan partner (deterministik -> chat lama bisa di-decrypt)
async function sharedSecretWith(partnerId) {
  const me = getSession()
  if (!me.privateKey) throw new Error('private key belum siap')
  const theirPub = await getPartnerPublicKey(partnerId)
  return deriveSharedSecret(me.privateKey, theirPub)
}

// Search username (RPC di DB, di-cap 20)
export async function searchUsers(query) {
  const { data, error } = await supabase.rpc('search_users', { q: query })
  if (error) throw error
  return data || []
}

// Buat conversation 1-on-1 (RPC)
export async function startConversationWith(targetUserId) {
  const id = typeof targetUserId === 'string' ? targetUserId : targetUserId?.id
  if (!id) throw new Error('partner id invalid')
  const { data, error } = await supabase.rpc('create_conversation_with', { target_user_id: id })
  if (error) throw error
  return data // conversation id
}

// Ambil list conversation milik user + partner-nya (tanpa embedding PostgREST)
export async function listConversations() {
  const me = getSession().userId
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', me)
  if (error) throw error
  const convIds = [...new Set((data || []).map((d) => d.conversation_id))] // dedupe
  if (!convIds.length) return []

  const { data: members, error: e2 } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in('conversation_id', convIds)
  if (e2) throw e2

  const partnerIds = [...new Set(members.filter((m) => m.user_id !== me).map((m) => m.user_id))]
  const profilesMap = {}
  if (partnerIds.length) {
    // RPC security definer (bypass RLS) -> nama user lain pasti muncul
    const { data: profs } = await supabase.rpc('get_profiles_by_ids', { ids: partnerIds })
    profs?.forEach((p) => (profilesMap[p.id] = p))
  }

  return convIds.map((cid) => {
    const partnerId = members.find((m) => m.conversation_id === cid && m.user_id !== me)?.user_id
    return { conversationId: cid, partner: profilesMap[partnerId] || { id: partnerId } }
  })
}

// Cek apa sudah ada conversation 1-on-1 dengan user ini (biar ga dobel)
export async function findExistingConversation(targetUserId) {
  const me = getSession().userId
  const { data } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', me)
  const myConvIds = (data || []).map((d) => d.conversation_id)
  if (!myConvIds.length) return null
  const { data: shared } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .in('conversation_id', myConvIds)
    .eq('user_id', targetUserId)
  return shared?.[0]?.conversation_id || null
}

// Load pesan lama (decrypt semua) — cache dulu (offline/instant), lalu sync server
import {
  cacheMessages, getCachedMessages, cacheMessage, deleteCachedMessage, clearAllCache,
} from './cache'

export async function loadMessages(conversationId) {
  const me = getSession().userId
  // 1) cache lokal dulu (langsung tampil, jalan offline)
  let cached = []
  try { cached = await getCachedMessages(conversationId) } catch {}
  const cachedMap = new Map(cached.map((m) => [m.id, m]))

  // 2) fetch dari server (sync pesan baru / perubahan)
  let data = []
  try {
    const { data: d, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (!error) data = d || []
  } catch { /* offline: pakai cache */ }

  const visible = data.filter((m) => {
    if (m.deleted_for_all) return false
    if (Array.isArray(m.deleted_for) && m.deleted_for.includes(me)) return false
    return true
  })

  let out = []
  try {
    const ss = await sharedSecretWith(partnerOf(conversationId))
    out = await Promise.all(visible.map(async (m) => {
      const plaintext = m.ciphertext ? await decryptText(ss, m.ciphertext, m.nonce) : null
      return {
        id: m.id, senderId: m.sender_id, plaintext, createdAt: m.created_at,
        mediaPath: m.media_path, media_iv: m.media_iv, media_type: m.media_type,
        reply_to: m.reply_to || null, edited_at: m.edited_at || null, conversationId,
      }
    }))
  } catch (e) {
    console.warn('decrypt gagal, pakai cache:', e.message)
  }

  // 3) tulis ke cache (server punya otoritas penuh)
  try { await cacheMessages(conversationId, out) } catch {}

  // 4) kalau server kosong (offline/error) tapi cache ada -> pakai cache
  if (!out.length && cached.length) {
    return cached.map((m) => ({ ...m, edited: !!m.edited_at }))
  }
  return out
}

// partner id per conversation (cache dari listConversations)
const convPartner = new Map()
function partnerOf(conversationId) {
  return convPartner.get(conversationId)
}
export function rememberPartner(conversationId, partnerId) {
  convPartner.set(conversationId, partnerId)
}

// Kirim pesan text terenkripsi
export async function sendText(conversationId, partnerId, text, replyTo = null) {
  const ss = await sharedSecretWith(partnerId)
  const { ciphertext, nonce } = await encryptText(ss, text)
  const insertObj = {
    conversation_id: conversationId,
    sender_id: getSession().userId,
    ciphertext,
    nonce,
  }
  if (replyTo) insertObj.reply_to = replyTo
  const { data, error } = await supabase.from('messages').insert(insertObj).select('id, created_at').single()
  if (error) throw error
  // cache optimistic (biar muncul & persist walau offline)
  try {
    await cacheMessage({
      id: data.id, senderId: getSession().userId, plaintext: text, createdAt: data.created_at,
      ciphertext, nonce, mediaPath: null, media_iv: null, media_type: null,
      reply_to: replyTo || null, edited_at: null, conversationId,
    })
  } catch {}
  return { id: data.id, createdAt: data.created_at }
}

// Edit pesan milik sendiri (maks 10 menit) — re-encrypt + set edited_at
export async function editMessage(messageId, partnerId, newText) {
  const ss = await sharedSecretWith(partnerId)
  const { ciphertext, nonce } = await encryptText(ss, newText)
  const { error } = await supabase
    .from('messages')
    .update({ ciphertext, nonce, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', getSession().userId)
  if (error) throw error
  try {
    const existing = await getCachedMessage(messageId)
    if (existing) { existing.plaintext = newText; existing.ciphertext = ciphertext; existing.nonce = nonce; existing.edited_at = new Date().toISOString(); await cacheMessage(existing) }
  } catch {}
}

// Kirim foto terenkripsi (upload ke Storage bucket 'media')
export async function sendPhoto(conversationId, partnerId, file) {
  const ss = await sharedSecretWith(partnerId)
  const buf = new Uint8Array(await file.arrayBuffer())
  const { ciphertext, nonce } = await encryptBytes(ss, buf)
  const path = `${conversationId}/${crypto.randomUUID()}.enc`
  const { error: upErr } = await supabase.storage
    .from('media')
    .upload(path, sodium_b64_to_bytes(ciphertext), { contentType: 'application/octet-stream' })
  if (upErr) throw upErr
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: getSession().userId,
    ciphertext: '', // foto ga pakai text ciphertext
    nonce,
    media_path: path,
    media_iv: nonce,
    media_type: file.type,
  })
  if (error) throw error
}

function sodium_b64_to_bytes(b64) {
  // tolerate URL-safe base64 (- _ ) yang mungkin dihasilkan libsodium
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(norm)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Subscribe realtime pesan baru (Postgres Changes) + fallback polling 3s
// (biar ga perlu klik nama kalau WS ga connect)
export function subscribeMessages(conversationId, onNew, onUpdate) {
  let lastSeen = Date.now()
  let polling = false

  const channel = supabase
    .channel('msgs:' + conversationId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      async (payload) => {
        const m = payload.new
        // jangan echo pesan kita sendiri (sudah di-push optimistic di onSend)
        if (m.sender_id === getSession().userId) return
        try {
          const ss = await sharedSecretWith(partnerOf(conversationId))
          const plaintext = m.ciphertext ? await decryptText(ss, m.ciphertext, m.nonce) : null
          const row = {
            id: m.id, senderId: m.sender_id, plaintext,
            mediaPath: m.media_path, media_iv: m.media_iv, media_type: m.media_type,
            reply_to: m.reply_to || null, createdAt: m.created_at, conversationId,
          }
          onNew(row)
          try { await cacheMessage(row) } catch {}
        } catch (e) {
          console.warn('decrypt gagal:', e.message)
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const m = payload.new
        // pesan dihapus untuk semua -> hide realtime + hapus cache
        if (m.deleted_for_all) { onUpdate?.({ id: m.id, deleted: true }); try { deleteCachedMessage(m.id) } catch {} }
      }
    )
    .subscribe((status) => {
      console.log('[realtime]', conversationId, status)
      if (status === 'SUBSCRIBED') {
        // WS jalan -> stop polling
        polling = false
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // WS gagal -> mulai polling fallback
        if (!polling) startPolling()
      }
    })

  async function startPolling() {
    polling = true
    const timer = setInterval(async () => {
      if (!polling) return clearInterval(timer)
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .gt('created_at', new Date(lastSeen).toISOString())
          .order('created_at', { ascending: true })
        if (data?.length) {
          const ss = await sharedSecretWith(partnerOf(conversationId))
          for (const m of data) {
            lastSeen = Math.max(lastSeen, new Date(m.created_at).getTime())
            const plaintext = m.ciphertext ? await decryptText(ss, m.ciphertext, m.nonce) : null
            onNew({ id: m.id, senderId: m.sender_id, plaintext, mediaPath: m.media_path, createdAt: m.created_at, reply_to: m.reply_to || null })
          }
        }
      } catch {}
    }, 3000)
    pollTimers.set(conversationId, timer)
  }

  return () => {
    polling = false
    const t = pollTimers.get(conversationId)
    if (t) clearInterval(t)
    supabase.removeChannel(channel)
  }
}

const pollTimers = new Map()

// --- Typing indicator (Realtime Broadcast, ephemeral, ga ke-DB) ---
export function subscribeTyping(conversationId, myId, onTyping) {
  const channel = supabase
    .channel('typing:' + conversationId)
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.userId !== myId) onTyping?.(payload.userId)
    })
    .subscribe()
  return {
    send: () => channel.send({ type: 'broadcast', event: 'typing', payload: { userId: myId } }),
    unsubscribe: () => supabase.removeChannel(channel),
  }
}

// --- Online presence (Realtime Presence) ---
export function subscribePresence(conversationId, myId, onSync) {
  const channel = supabase
    .channel('presence:' + conversationId, { config: { presence: { key: myId } } })
    .on('presence', { event: 'sync' }, () => onSync(channel.presenceState()))
    .on('presence', { event: 'join' }, () => onSync(channel.presenceState()))
    .on('presence', { event: 'leave' }, () => onSync(channel.presenceState()))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ userId: myId, online_at: Date.now() })
        clearInterval(channel._hb)
        channel._hb = setInterval(() => {
          if (channel.state === 'subscribed') channel.track({ userId: myId, online_at: Date.now() })
        }, 8000)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearInterval(channel._hb)
        setTimeout(() => { channel.subscribe() }, 2000)
      }
    })
  return {
    refresh: () => onSync(channel.presenceState()),
    unsubscribe: () => {
      clearInterval(channel._hb)
      supabase.removeChannel(channel)
    },
  }
}

// Download + decrypt foto -> return object URL (siap di <img src>)
export async function getPhoto(conversationId, partnerId, path, iv) {
  const { data, error } = await supabase.storage.from('media').download(path)
  if (error) throw error
  const bytes = new Uint8Array(await data.arrayBuffer())
  const ss = await sharedSecretWith(partnerId)
  const plain = await decryptBytes(ss, bytes, iv)
  const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.gif') ? 'image/gif' : 'image/jpeg'
  return URL.createObjectURL(new Blob([plain], { type }))
}

// --- Delete / receipt / profile (Phase H) ---

// Hapus percakapan "untuk saya" (hapus membership kita -> hilang dari list kita)
export async function deleteConversation(conversationId) {
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', getSession().userId)
  if (error) throw error
  try { await clearConvCache(conversationId) } catch {}
}

// Hapus percakapan "untuk semua" (hapus pesan + members + conversation -> lawan kehilangan semua)
export async function deleteConversationForAll(conversationId) {
  const { error } = await supabase.rpc('delete_conversation_for_all', { conv_id: conversationId })
  if (error) throw error
}

// Soft delete akun (tandai deleted_at)
export async function softDeleteAccount() {
  const { error } = await supabase.rpc('soft_delete_account')
  if (error) throw error
}

// Reset total pas daftar ulang (akun yang pernah di-soft-delete):
// hapus membership lama + clear deleted_at/display/username/public_key
export async function reset_my_account() {
  const { error } = await supabase.rpc('reset_my_account')
  if (error) throw error
  // kosongin semua cache chat (mulai dari nol)
  try { await clearAllCache() } catch {}
}

// Hapus pesan "untuk saya" -> append user ke deleted_for[]
export async function deleteMessageForMe(messageId) {
  const { error } = await supabase.rpc('delete_message_for_me', { msg_id: messageId })
  if (error) throw error
  try { await deleteCachedMessage(messageId) } catch {}
}

// Hapus pesan "untuk semua" (hanya sender) -> set deleted_for_all
export async function deleteMessageForAll(messageId, conversationId) {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_for_all: true })
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', getSession().userId)
  if (error) throw error
  try { await deleteCachedMessage(messageId) } catch {}
}

// Tandai pesan partner sebagai delivered (pas kita subscribe/online)
export async function markDelivered(conversationId) {
  try { await supabase.rpc('mark_delivered', { conversation: conversationId }) } catch {}
}

// Tandai pesan partner sebagai read (pas kita buka room)
export async function markRead(conversationId) {
  try { await supabase.rpc('mark_read', { conversation: conversationId }) } catch {}
}

// Update display name
export async function updateDisplayName(name) {
  const { error } = await supabase.rpc('set_display_name', { p_name: name })
  if (error) throw error
}

// Online presence fallback: ambil last_seen partner dari DB
export async function getLastSeen(targetUserId) {
  const { data, error } = await supabase.rpc('get_last_seen', { target_user_id: targetUserId })
  if (error) return null
  return data ? new Date(data).getTime() : null
}

// Heartbeat: update last_seen kita (biar lawan liat kita online)
export async function touchLastSeen() {
  try { await supabase.rpc('touch_last_seen') } catch {}
}

// Upload avatar ke Storage bucket 'avatars', return public URL
export async function uploadAvatar(file) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${getSession().userId}/avatar.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
