// supabase/functions/bot-reply/index.ts
// Dipanggil via DB Webhook (public.messages INSERT).
// Flow: decrypt pesan user -> POST OpenRouter -> encrypt balasan -> INSERT.
// Crypto byte-exact dengan src/lib/crypto.js (libsodium crypto_box + secretbox).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import sodium from 'https://esm.sh/libsodium-wrappers@0.7.11'

const BOT_PRIVATE_KEY = Deno.env.get('BOT_PRIVATE_KEY')   // base64 X25519 priv
const BOT_USER_ID     = Deno.env.get('BOT_USER_ID')       // uuid bot
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

await sodium.ready

// --- crypto helpers (mirror src/lib/crypto.js) ---
function b64dec(b: string): Uint8Array { return sodium.from_base64(b) }
function b64enc(u: Uint8Array): string { return sodium.to_base64(u) }

function deriveSharedSecret(myPrivB64: string, theirPubB64: string): string {
  const shared = sodium.crypto_scalarmult(b64dec(myPrivB64), b64dec(theirPubB64))
  return b64enc(shared)
}
function decryptText(ssB64: string, ctB64: string, nonceB64: string): string {
  const pt = sodium.crypto_secretbox_open_easy(b64dec(ctB64), b64dec(nonceB64), b64dec(ssB64))
  return sodium.to_string(pt)
}
function encryptText(ssB64: string, plaintext: string): { ciphertext: string; nonce: string } {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ct = sodium.crypto_secretbox_easy(sodium.from_string(plaintext), nonce, b64dec(ssB64))
  return { ciphertext: b64enc(ct), nonce: b64enc(nonce) }
}

// throttle per conversation (anti token blow-up) — in-memory (per instance)
const lastCall = new Map<string, number>()
const THROTTLE_MS = 1500

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    // DB Webhook v1: { type, table, record, ... }
    const rec = payload.record
    if (!rec) return json({ ok: true, skipped: 'no record' })

    const senderId = rec.sender_id
    const convId   = rec.conversation_id
    const ct       = rec.ciphertext
    const nonce    = rec.nonce

    // diagnostic: cek secret kebaca atau gak
    if (!BOT_PRIVATE_KEY) return json({ ok: false, error: 'BOT_PRIVATE_KEY not set / empty' })

    // guard: jangan proses pesan dari bot sendiri (anti echo loop)
    if (!senderId || senderId === BOT_USER_ID) return json({ ok: true, skipped: 'bot self' })
    if (!convId || !ct || !nonce) return json({ ok: true, skipped: 'incomplete' })

    // throttle
    const now = Date.now()
    const last = lastCall.get(convId) ?? 0
    if (now - last < THROTTLE_MS) return json({ ok: true, skipped: 'throttled' })
    lastCall.set(convId, now)

    // load config (RLS deny, tapi service_role bypass)
    const { data: cfg } = await supabase.from('bot_config').select('*').eq('id', 1).single()
    if (!cfg) return json({ ok: false, error: 'no config' })

    // pubkey user
    const { data: prof } = await supabase
      .from('profiles').select('public_key').eq('id', senderId).single()
    if (!prof?.public_key) return json({ ok: false, error: 'no user pubkey' })

    // decrypt pesan user
    let ss = ''
    try { ss = deriveSharedSecret(BOT_PRIVATE_KEY, prof.public_key) }
    catch { return json({ ok: false, error: 'deriveSharedSecret failed (BOT_PRIVATE_KEY or pubkey invalid base64)' }) }
    let userText = ''
    try { userText = decryptText(ss, ct, nonce) }
    catch (e) {
      return json({ ok: false, error: 'decrypt failed (wrong secret key / ciphertext mismatch)', detail: String(e?.message || e), luPubDb: prof.public_key })
    }
    if (!userText.trim()) return json({ ok: true, skipped: 'empty' })

    // ambil history singkat (3 pesan terakhir dari user & bot) buat konteks
    const { data: hist } = await supabase
      .from('messages')
      .select('sender_id, ciphertext, nonce')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(6)
    const messages: any[] = [{ role: 'system', content: cfg.system_prompt }]
    for (const h of (hist || []).reverse()) {
      if (!h.ciphertext || !h.nonce) continue
      try {
        const t = decryptText(ss, h.ciphertext, h.nonce)
        messages.push({ role: h.sender_id === BOT_USER_ID ? 'assistant' : 'user', content: t })
      } catch {}
    }
    // ganti pesan terakhir user dgn yg baru (karena `hist` limit 6 udah include pesan ini)
    messages[messages.length - 1] = { role: 'user', content: userText }

    // hit OpenRouter
    const orRes = await fetch(cfg.openrouter_endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.openrouter_api_key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SUPABASE_URL,
        'X-Title': 'utext AI',
      },
      body: JSON.stringify({
        model: cfg.openrouter_model,
        messages,
        max_tokens: cfg.max_tokens ?? 800,
        temperature: 0.7,
      }),
    })
    if (!orRes.ok) {
      const e = await orRes.text()
      return json({ ok: false, error: 'openrouter ' + orRes.status, detail: e.slice(0, 300) })
    }
    const orJson = await orRes.json()
    const reply = orJson?.choices?.[0]?.message?.content?.trim()
    if (!reply) return json({ ok: false, error: 'empty reply' })

    // encrypt balasan & INSERT
    const enc = encryptText(ss, reply)
    const { error: insErr } = await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: BOT_USER_ID,
      ciphertext: enc.ciphertext,
      nonce: enc.nonce,
      status: 'sent',
    })
    if (insErr) return json({ ok: false, error: insErr.message })
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) })
  }
})

function json(o: any) {
  return new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } })
}
