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
  const { data, error } = await supabase.rpc('create_conversation_with', { target_user_id: targetUserId })
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
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', partnerIds)
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

// Load pesan lama (decrypt semua)
export async function loadMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const ss = await sharedSecretWith(partnerOf(conversationId))
  return await Promise.all(
    (data || []).map(async (m) => {
      const plaintext = m.ciphertext
        ? await decryptText(ss, m.ciphertext, m.nonce)
        : null
      return {
        id: m.id,
        senderId: m.sender_id,
        plaintext,
        createdAt: m.created_at,
        mediaPath: m.media_path,
        media_iv: m.media_iv,
        media_type: m.media_type,
      }
    })
  )
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
export async function sendText(conversationId, partnerId, text) {
  const ss = await sharedSecretWith(partnerId)
  const { ciphertext, nonce } = await encryptText(ss, text)
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: getSession().userId,
    ciphertext,
    nonce,
  })
  if (error) throw error
}

// Kirim foto terenkripsi (upload ke Storage bucket 'media')
export async function sendPhoto(conversationId, partnerId, file) {
  const ss = await sharedSecretWith(partnerId)
  const buf = new Uint8Array(await file.arrayBuffer())
  const { ciphertext, nonce } = await encryptBytes(ss, buf)
  const path = `${conversationId}/${crypto.randomUUID()}.enc`
  const { error: upErr } = await supabase.storage
    .from('media')
    .upload(path, sodium_b64_to_blob(ciphertext), { contentType: 'application/octet-stream' })
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

function sodium_b64_to_blob(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: 'application/octet-stream' })
}

// Subscribe realtime pesan baru (Postgres Changes) + fallback polling 3s
// (biar ga perlu klik nama kalau WS ga connect)
export function subscribeMessages(conversationId, onNew) {
  let lastSeen = Date.now()
  let polling = false

  const channel = supabase
    .channel('msgs:' + conversationId)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      async (payload) => {
        const m = payload.new
        try {
          const ss = await sharedSecretWith(partnerOf(conversationId))
          const plaintext = m.ciphertext ? await decryptText(ss, m.ciphertext, m.nonce) : null
          onNew({
            id: m.id,
            senderId: m.sender_id,
            plaintext,
            mediaPath: m.media_path,
            media_iv: m.media_iv,
            media_type: m.media_type,
            createdAt: m.created_at,
          })
        } catch (e) {
          console.warn('decrypt gagal:', e.message)
        }
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
            onNew({ id: m.id, senderId: m.sender_id, plaintext, mediaPath: m.media_path, createdAt: m.created_at })
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

// Download + decrypt foto
export async function getPhoto(conversationId, partnerId, path, iv) {
  const { data, error } = await supabase.storage.from('media').download(path)
  if (error) throw error
  const bytes = new Uint8Array(await data.arrayBuffer())
  const ss = await sharedSecretWith(partnerId)
  const ctB64 = btoa(String.fromCharCode(...bytes))
  return await decryptBytes(ss, ctB64, iv)
}
