<!-- src/components/ChatView.vue -->
<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  searchUsers, startConversationWith, listConversations, loadMessages,
  sendText, sendPhoto, subscribeMessages, rememberPartner, getPhoto,
  findExistingConversation, subscribeTyping, subscribePresence,
} from '../lib/chat'
import { getSession, getMyProfile, updateUsername, logout, identityStatus, backupToDrive, restoreFromDrive } from '../lib/auth'

const me = ref(getSession().userId)
const myUsername = ref('')
const conversations = ref([])
const activeConv = ref(null)
const messages = ref([])
const partner = ref(null)
const draft = ref('')
const searchQ = ref('')
const searchResults = ref([])
const unsub = ref(null)
const photoInput = ref(null)
const editing = ref(false)
const newUsername = ref('')
const photoUrls = ref({})
const backupMsg = ref('')
const pendingPhoto = ref(null) // { file, url } — preview sebelum kirim
const LS_ROOM = 'utext_last_room'
const typingUnsub = ref(null)
const presenceUnsub = ref(null)
const isPartnerTyping = ref(false)
const partnerOnline = ref(false)
let typingTimer = null

watch(me, (v) => { me.value = v })

onMounted(async () => {
  const p = await getMyProfile()
  myUsername.value = p?.username || ''
  conversations.value = await listConversations()
  // restore last room dari localStorage
  try {
    const saved = JSON.parse(localStorage.getItem(LS_ROOM) || 'null')
    if (saved?.conversationId) {
      const conv = conversations.value.find((c) => c.conversationId === saved.conversationId)
      if (conv) await openConversation(conv)
    }
  } catch {}
})

onUnmounted(() => {
  unsub.value?.()
  typingUnsub.value?.()
  presenceUnsub.value?.()
  Object.values(photoUrls.value).forEach(URL.revokeObjectURL)
})

async function saveUsername() {
  try {
    await updateUsername(newUsername.value.trim())
    myUsername.value = newUsername.value.trim()
    editing.value = false
  } catch (e) { alert('Gagal: ' + e.message) }
}

async function doBackup() {
  backupMsg.value = 'backup…'
  try { await backupToDrive(); backupMsg.value = '✅ backed up' }
  catch (e) { backupMsg.value = '❌ ' + e.message }
}

async function doRestore() {
  backupMsg.value = 'restore…'
  try { await restoreFromDrive(); backupMsg.value = '✅ restored'; identityStatus.value = 'ok' }
  catch (e) { backupMsg.value = '❌ ' + e.message }
}

async function doSearch() {
  if (searchQ.value.length < 2) return
  searchResults.value = await searchUsers(searchQ.value)
}

async function openConversation(conv) {
  if (!getSession().privateKey) {
    alert('Kunci belum siap. Klik "Restore Drive" dulu (atau tunggu sebentar).')
    if (identityStatus.value === 'need_restore') return
  }
  activeConv.value = conv.conversationId
  partner.value = conv.partner
  rememberPartner(conv.conversationId, conv.partner.id)
  messages.value = await loadMessages(conv.conversationId)
  unsub.value?.()
  unsub.value = subscribeMessages(conv.conversationId, (m) => messages.value.push(m))
  // typing indicator
  typingUnsub.value?.()
  const typing = subscribeTyping(conv.conversationId, me.value, () => {
    isPartnerTyping.value = true
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => { isPartnerTyping.value = false }, 1500)
  })
  typingUnsub.value = typing
  typingOn = typing.send
  // presence (online) — recency: partner dianggap online kalau track < 20s lalu
  partnerOnline.value = false
  presenceUnsub.value?.()
  presenceUnsub.value = subscribePresence(conv.conversationId, me.value, (state) => {
    const others = Object.values(state).flat().filter((p) => p.userId !== me.value)
    const fresh = others.some((p) => Date.now() - (p.online_at || 0) < 20000)
    partnerOnline.value = fresh
  })
  // simpan last room
  try { localStorage.setItem(LS_ROOM, JSON.stringify({ conversationId: conv.conversationId })) } catch {}
  // preload foto
  for (const m of messages.value) if (m.mediaPath) await preloadPhoto(m)
}

let typingOn = null
function notifyTyping() {
  if (typingOn) typingOn()
  isPartnerTyping.value = false
  clearTimeout(typingTimer)
  typingTimer = setTimeout(() => { isPartnerTyping.value = false }, 3000)
}

async function startChat(user) {
  // HANYA preview — ga bikin conversation sampai pesan pertama dikirim
  partner.value = user
  activeConv.value = null
  messages.value = []
  searchResults.value = []
  searchQ.value = ''
}

async function ensureConversation() {
  if (activeConv.value) return activeConv.value
  const cid = await startConversationWith(partner.value.id)
  activeConv.value = cid
  const conv = { conversationId: cid, partner: partner.value }
  if (!conversations.value.find((c) => c.conversationId === cid)) conversations.value.push(conv)
  rememberPartner(cid, partner.value.id)
  unsub.value?.()
  unsub.value = subscribeMessages(cid, (m) => messages.value.push(m))
  return cid
}

async function send() {
  if (!draft.value.trim() || !partner.value) return
  const text = draft.value
  draft.value = ''
  isPartnerTyping.value = false
  const cid = await ensureConversation()
  await sendText(cid, partner.value.id, text)
  messages.value.push({ id: crypto.randomUUID(), senderId: me.value, plaintext: text, createdAt: new Date().toISOString() })
}

function onDraftInput() {
  // notify partner that we're typing (throttled via typingOn + timer)
  if (typingOn) typingOn()
  isPartnerTyping.value = false
  clearTimeout(typingTimer)
  typingTimer = setTimeout(() => { isPartnerTyping.value = false }, 1500)
}

// Pilih foto -> HANYA preview, BELUM kirim
function onPickPhoto(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file || !partner.value) return
  // bersihkan preview lama
  if (pendingPhoto.value?.url) URL.revokeObjectURL(pendingPhoto.value.url)
  pendingPhoto.value = { file, url: URL.createObjectURL(file) }
}

// Konfirmasi kirim foto (user klik "Kirim")
async function confirmPhoto() {
  if (!pendingPhoto.value) return
  const file = pendingPhoto.value.file
  pendingPhoto.value = null
  try {
    const cid = await ensureConversation()
    await sendPhoto(cid, partner.value.id, file)
  } catch (err) {
    alert('Gagal kirim foto: ' + err.message)
  }
}

// Batal kirim foto
function cancelPhoto() {
  if (pendingPhoto.value?.url) URL.revokeObjectURL(pendingPhoto.value.url)
  pendingPhoto.value = null
}

// preload foto (dipanggil pas loadMessages + pas realtime dapet mediaPath)
async function preloadPhoto(m) {
  if (!m.mediaPath || m.mediaPath === 'pending' || photoUrls.value[m.id]) return
  try {
    const bytes = await getPhoto(activeConv.value, partner.value.id, m.mediaPath, m.media_iv)
    photoUrls.value[m.id] = URL.createObjectURL(new Blob([bytes]))
  } catch (e) { console.warn('preload foto gagal:', e.message) }
}

// pas realtime echo dapet pesan foto, preload
watch(messages, (vals) => {
  for (const m of vals) if (m.mediaPath && m.mediaPath !== 'pending') preloadPhoto(m)
}, { deep: true })
</script>

<template>
  <div class="chat">
    <aside>
      <div class="me-box">
        <span v-if="!editing">@{{ myUsername }}</span>
        <input v-else v-model="newUsername" @keyup.enter="saveUsername" placeholder="new username" />
        <button v-if="!editing" @click="editing = true; newUsername = myUsername">edit</button>
        <button v-else @click="saveUsername">save</button>
        <button v-if="identityStatus === 'new'" @click="doBackup">Backup Drive</button>
        <button v-else-if="identityStatus === 'need_restore'" @click="doRestore">Restore Drive</button>
        <span class="backmsg">{{ backupMsg }}</span>
        <button @click="logout">logout</button>
      </div>
      <input v-model="searchQ" @input="doSearch" placeholder="Search username…" />
      <ul v-if="searchResults.length" class="search">
        <li v-for="u in searchResults" :key="u.id" @click="startChat(u)">
          {{ u.username || u.display_name }}
        </li>
      </ul>
      <ul class="convs">
        <li v-for="c in conversations" :key="c.conversationId" @click="openConversation(c)">
          {{ c.partner?.username || c.partner?.display_name || '…' }}
        </li>
      </ul>
    </aside>
    <main v-if="partner">
      <header>@{{ partner?.username || partner?.display_name }}
        <span :class="['dot', partnerOnline ? 'on' : 'off']" :title="partnerOnline ? 'online' : 'offline'"></span>
      </header>
      <div class="msgs">
        <div v-for="m in messages" :key="m.id" :class="['bubble', m.senderId === me ? 'me' : 'them']">
          <template v-if="m.plaintext">{{ m.plaintext }}</template>
          <img v-else-if="photoUrls[m.id]" :src="photoUrls[m.id]" class="photo" />
          <span v-else-if="m.mediaPath">📷 loading…</span>
        </div>
        <div v-if="!activeConv" class="hint">Belum ada pesan — kirim untuk mulai percakapan</div>
        <div v-if="isPartnerTyping" class="typing">…sedang mengetik</div>
      </div>
      <form @submit.prevent="send">
        <input type="file" accept="image/*" ref="photoInput" @change="onPickPhoto" hidden />
        <button type="button" @click="photoInput?.click()">📷</button>
        <input v-model="draft" @input="onDraftInput" placeholder="Type…" />
        <button type="submit">Send</button>
      </form>
      <div v-if="pendingPhoto" class="photo-confirm">
        <img :src="pendingPhoto.url" class="preview" />
        <div class="photo-actions">
          <button type="button" @click="confirmPhoto">Kirim</button>
          <button type="button" @click="cancelPhoto">Batal</button>
        </div>
      </div>
    </main>
    <main v-else class="empty">Pilih atau cari user untuk mulai chat</main>
  </div>
</template>

<style scoped>
.chat { display: flex; height: 100vh; font-family: sans-serif; }
aside { width: 280px; border-right: 1px solid #ddd; padding: 8px; overflow-y: auto; }
.me-box { display: flex; gap: 4px; align-items: center; padding: 6px; background: #f7f7f7; border-radius: 8px; margin-bottom: 8px; font-size: 13px; }
.convs, .search { list-style: none; padding: 0; margin: 8px 0; }
.convs li, .search li { padding: 8px; cursor: pointer; border-radius: 6px; }
.convs li:hover, .search li:hover { background: #f0f0f0; }
main { flex: 1; display: flex; flex-direction: column; }
.empty { align-items: center; justify-content: center; color: #888; }
.msgs { flex: 1; overflow-y: auto; padding: 12px; }
.bubble { max-width: 60%; padding: 8px 12px; border-radius: 12px; margin: 4px 0; }
.me { background: #1a73e8; color: #fff; margin-left: auto; }
.them { background: #eee; }
.photo { max-width: 200px; border-radius: 8px; }
.hint { color: #999; font-size: 13px; text-align: center; margin: 12px 0; }
.typing { color: #888; font-style: italic; font-size: 13px; margin: 4px 0; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 6px; vertical-align: middle; }
.dot.on { background: #2ecc71; }
.dot.off { background: #bbb; }
form { display: flex; padding: 8px; gap: 8px; border-top: 1px solid #ddd; }
form input:not([type=file]) { flex: 1; padding: 8px; }
.photo-confirm { padding: 8px; border-top: 1px solid #ddd; display: flex; gap: 12px; align-items: center; }
.photo-confirm .preview { max-width: 120px; max-height: 120px; border-radius: 8px; }
.photo-actions { display: flex; flex-direction: column; gap: 6px; }
</style>
