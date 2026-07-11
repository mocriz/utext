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

// Ambil list conversation milik user (via conversation_members)
export async function listConversations() {
  const me = getSession().userId
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, profiles:user_id(id, username, display_name, avatar_url)')
    .eq('user_id', me)
  if (error) throw error
  // filter out diri sendiri, ambil partner
  const convs = (data || []).map((row) => {
    const partner = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return { conversationId: row.conversation_id, partner }
  })
  return convs
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
    (data || []).map(async (m) => ({
      id: m.id,
      senderId: m.sender_id,
      plaintext: await decryptText(ss, m.ciphertext, m.nonce),
      createdAt: m.created_at,
      mediaPath: m.media_path,
    }))
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

// Subscribe realtime pesan baru (Postgres Changes)
export function subscribeMessages(conversationId, onNew) {
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
          onNew({ id: m.id, senderId: m.sender_id, plaintext, mediaPath: m.media_path, createdAt: m.created_at })
        } catch (e) {
          console.warn('decrypt gagal:', e.message)
        }
      }
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// Download + decrypt foto
export async function getPhoto(conversationId, partnerId, path, iv) {
  const { data, error } = await supabase.storage.from('media').download(path)
  if (error) throw error
  const bytes = new Uint8Array(await data.arrayBuffer())
  const ss = await sharedSecretWith(partnerId)
  const ctB64 = btoa(String.fromCharCode(...bytes))
  return await decryptBytes(ss, ctB64, iv)
}
