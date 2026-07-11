<template>
  <div class="shell">
    <div class="pane-sidebar" :class="{ 'hide-mobile': ui.mobileView === 'chat' }">
      <AppHeader
        :prefs="prefs"
        :profile="auth.profile"
        :searching="searching"
        :query="searchQuery"
        @open-search="openSearch"
        @close-search="closeSearch"
        @update:query="onSearchInput"
        @navigate="onNavigate"
        @logout="onLogout"
      />
      <Sidebar
        :conversations="conv.items"
        :active-id="ui.activeRoomId"
        :searching="searching"
        :results="searchResults"
        :query="searchQuery"
        @open="onOpen"
        @conv-menu="onConvMenu"
        @pick-user="startChat"
      />
    </div>
    <div class="pane-chat" :class="{ 'hide-mobile': ui.mobileView === 'list' }">
      <ChatPanel
        ref="chatPanel"
        v-if="activeConv && activePartner"
        :partner="activePartner"
        :messages="visibleMessages"
        :me-id="auth.user?.id"
        :typing="room.typing"
        :online="room.partnerOnline"
        :draft="room.draft"
        :preview="pendingPhoto"
        :reply-to="replyingTo"
        :editing="editingMsg"
        @back="closeRoom"
        @bubble-menu="onBubbleMenu"
        @jump="jumpTo"
        @update:draft="room.draft = $event"
        @typing="onTyping"
        @send="onSend"
        @pick="onPick"
        @confirm-photo="onConfirmPhoto"
        @cancel-photo="onCancelPhoto"
        @cancel-reply="cancelReply"
        @cancel-edit="cancelEdit"
      />
      <div v-else class="empty-chat">
        <div class="em">💬</div>
        <p>Pilih atau cari percakapan untuk mulai.</p>
      </div>
    </div>

    <!-- Context menu (bubble / conversation) -->
    <ContextMenu
      :show="ctx.show"
      :items="ctx.items"
      :x="ctx.x" :y="ctx.y"
      @select="onCtxSelect"
      @close="ctx.show = false"
    />

    <!-- Settings sheet -->
    <SettingsSheet
      :open="ui.settingsOpen"
      :profile="auth.profile"
      :prefs="prefs"
      :identity-status="auth.identityStatus"
      @close="ui.toggleSettings(false); settingsSection = 'profile'"
      @backup="onBackup"
      @restore="onRestore"
      @save-username="onSaveUsername"
      @save-display="onSaveDisplay"
      @avatar="onAvatar"
      @delete-account="onDeleteAccount"
      @update:prefs="prefs.set"
    />
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, watch, nextTick } from 'vue'
import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'
import { useConversationsStore } from '../../stores/conversations'
import { usePrefsStore } from '../../stores/prefs'
import { supabase } from '../../lib/supabase'
import AppHeader from '../organisms/AppHeader.vue'
import Sidebar from '../organisms/Sidebar.vue'
import ChatPanel from '../organisms/ChatPanel.vue'
import ContextMenu from '../molecules/ContextMenu.vue'
import SettingsSheet from '../organisms/SettingsSheet.vue'
import {
  loadMessages, sendText, sendPhoto, subscribeMessages, editMessage,
  subscribeTyping, subscribePresence, rememberPartner, getPhoto, findExistingConversation,
  deleteConversation, deleteMessageForMe, deleteMessageForAll, markDelivered, markRead,
  updateDisplayName as rpcUpdateDisplayName, uploadAvatar, searchUsers, startConversationWith,
} from '../../lib/chat'
import { backupToDrive, restoreFromDrive, updateUsername, getMyProfile, updateDisplayName, updateAvatar, softDeleteAccount } from '../../lib/auth'

const ui = useUiStore()
const auth = useAuthStore()
const conv = useConversationsStore()
const prefs = usePrefsStore()

const room = reactive({ messages: [], draft: '', typing: false, partnerOnline: false })
const activeConv = ref(null)
const activePartner = ref(null)
const pendingPhoto = ref(null)
const settingsSection = ref('profile')
const chatPanel = ref(null)
const ctx = reactive({ show: false, items: [], x: 0, y: 0, target: null })

// fokus ke field text (dipakai pas buka room, balas, edit, & keyboard fisik)
function focusComposer() { nextTick(() => chatPanel.value?.focus()) }

let typingCh = null, presenceCh = null, msgCh = null, typingTimer = null, presenceTimer = null, lastSeen = 0
const myId = computed(() => auth.user?.id)
const replyingTo = ref(null)   // { id, mine, name, text }
const editingMsg = ref(null)   // message object yg lagi diedit
const searching = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
let searchTimer = null
const EDIT_WINDOW_MS = 10 * 60 * 1000
const markedReadFor = new Set() // cegah markRead berulang per room
const seenMsgIds = new Set()    // cegah duplikat pesan realtime
function fmtTime(d) {
  const dt = new Date(d)
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtFull(d) {
  const dt = new Date(d)
  return dt.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
// enrich pesan jadi shape untuk render (time, fullTime, edited, replyTo)
function enrich(m) {
  m.time = fmtTime(m.createdAt)
  m.fullTime = fmtFull(m.createdAt)
  m.edited = !!m.editedAt
  return m
}

// poll status pesan kita (sent->delivered->read) dari DB
let receiptTimer = null
async function refreshReceipts(cid) {
  clearInterval(receiptTimer)
  receiptTimer = setInterval(async () => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('id, status')
        .eq('conversation_id', cid)
        .eq('sender_id', myId.value)
      const map = Object.fromEntries((data || []).map((x) => [x.id, x.status]))
      for (const m of room.messages) {
        if (m.senderId === myId.value && map[m.id] && m.receipt !== map[m.id]) m.receipt = map[m.id]
      }
    } catch {}
  }, 3000)
}

// ---- open / switch room ----
async function onOpen(c) {
  // guard: kalau room sama masih aktif, jangan re-subscribe (cegah leak + spam echo)
  if (activeConv.value === c.conversationId && room.messages.length) return
  activeConv.value = c.conversationId
  activePartner.value = c.partner
  ui.openRoom(c.conversationId)
  conv.clearUnread(c.conversationId)
  rememberPartner(c.conversationId, c.partner.id) // WAJIB sebelum loadMessages/subscribe
  room.messages = (await loadMessages(c.conversationId)).map(enrich)
  msgCh?.()
  msgCh = subscribeMessages(c.conversationId, (m) => {
    if (seenMsgIds.has(m.id)) return
    seenMsgIds.add(m.id)
    enrich(m)
    room.messages.push(m)
    conv.setLast(c.conversationId, m.plaintext || '📷 foto')
    // receipt: pesan dari partner -> delivered/read (jika pref on)
    if (m.senderId !== myId.value) {
      conv.bumpUnread(c.conversationId)
      if (prefs.readReceipt) markRead(c.conversationId)
      else markDelivered(c.conversationId)
    }
  })
  // tandai pesan partner sebagai read/delivered pas room dibuka (SEKALI)
  if (!markedReadFor.has(c.conversationId)) {
    markedReadFor.add(c.conversationId)
    if (prefs.readReceipt) markRead(c.conversationId)
    else markDelivered(c.conversationId)
  }
  // update receipt lokal pesan kita yang dikirim sebelumnya
  if (prefs.readReceipt) refreshReceipts(c.conversationId)
  setupTyping(c.conversationId)
  setupPresence(c.conversationId)
  // decrypt foto yg ada
  for (const m of room.messages) if (m.mediaPath) await preload(m)
  // update last message di list (decrypted)
  const last = room.messages[room.messages.length - 1]
  if (last) conv.setLast(c.conversationId, last.plaintext || '📷 foto')
  focusComposer()
}
function onNewChat(c) { onOpen(c) }

// ---- search user ----
function openSearch() { searching.value = true }
function closeSearch() { searching.value = false; searchQuery.value = ''; searchResults.value = [] }
function onSearchInput(q) {
  searchQuery.value = q
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (q.length < 2) return (searchResults.value = [])
    searchResults.value = await searchUsers(q)
  }, 250)
}
async function startChat(user) {
  searching.value = false
  searchQuery.value = ''
  searchResults.value = []
  const c = await startConversationWith(user)
  onOpen(c)
}

// ---- close room -> desktop: clear selection (sidebar tetap); mobile: balik list ----
function closeRoom() {
  ui.closeRoom()
  // revoke object URLs biar ga memory leak
  for (const m of room.messages) if (m.photoUrl?.startsWith('blob:')) URL.revokeObjectURL(m.photoUrl)
  activeConv.value = null
  activePartner.value = null
  room.messages = []
  room.typing = false
  msgCh?.(); msgCh = null
  typingCh?.(); typingCh = null
  presenceCh?.(); presenceCh = null
  clearInterval(presenceTimer)
  clearInterval(receiptTimer)
  clearTimeout(typingTimer)
  markedReadFor.clear()
  seenMsgIds.clear()
}

// ---- typing ----
function setupTyping(cid) {
  typingCh?.()
  const ch = subscribeTyping(cid, myId.value, () => {
    room.typing = true
    clearTimeout(typingTimer)
    typingTimer = setTimeout(() => (room.typing = false), 2000)
  })
  typingCh = ch.send
  ch.unsub = ch.unsubscribe
}
function onTyping() {
  typingCh?.()
  room.typing = false
  clearTimeout(typingTimer)
  typingTimer = setTimeout(() => (room.typing = false), 1500)
}

// ---- presence ----
function setupPresence(cid) {
  presenceCh?.()
  presenceCh = subscribePresence(cid, myId.value, (state) => {
    const others = Object.values(state).flat().filter((p) => p.userId !== myId.value)
    lastSeen = Math.max(0, ...others.map((p) => p.online_at || 0))
    room.partnerOnline = Date.now() - lastSeen < 20000
  })
  clearInterval(presenceTimer)
  presenceTimer = setInterval(() => { room.partnerOnline = Date.now() - lastSeen < 20000 }, 5000)
}

// ---- send (atau simpan edit) ----
async function onSend() {
  const text = room.draft.trim()
  if (!text || !activeConv.value) return
  room.draft = ''

  // mode EDIT
  if (editingMsg.value) {
    const m = editingMsg.value
    editingMsg.value = null
    await editMessage(m.id, activePartner.value.id, text)
    m.plaintext = text
    m.edited = true
    return
  }

  // pastikan conversation ada (startConversationWith lazy)
  let cid = activeConv.value
  if (!cid) {
    cid = await findExistingConversation(activePartner.value.id)
    if (!cid) cid = (await import('../../lib/chat')).startConversationWith(activePartner.value)
    activeConv.value = cid
  }
  const replyId = replyingTo.value?.id || null
  replyingTo.value = null
  await sendText(cid, activePartner.value.id, text, replyId)
  conv.setLast(cid, text)
  room.messages.push(enrich({ id: crypto.randomUUID(), senderId: myId.value, plaintext: text, createdAt: new Date().toISOString(), reply_to: replyId, receipt: 'sent' }))
}

// ---- photo (preview dulu) ----
function onPick(e) {
  const f = e.target.files?.[0]
  if (!f) return
  URL.revokeObjectURL(pendingPhoto.value?.url || '')
  pendingPhoto.value = { file: f, url: URL.createObjectURL(f), name: f.name }
}
function onCancelPhoto() { URL.revokeObjectURL(pendingPhoto.value?.url); pendingPhoto.value = null }
async function onConfirmPhoto() {
  const p = pendingPhoto.value; if (!p) return
  await sendPhoto(activeConv.value, activePartner.value.id, p.file)
  room.messages.push({ id: crypto.randomUUID(), senderId: myId.value, mediaPath: 'pending', time: now(), receipt: 'sent' })
  onCancelPhoto()
}

// ---- preload foto ----
async function preload(m) {
  if (!m.mediaPath || m.mediaPath === 'pending' || m.photoUrl) return
  try {
    m.photoUrl = await getPhoto(activeConv.value, activePartner.value.id, m.mediaPath, m.media_iv)
  } catch { m.photoUrl = '' }
}

// ---- context menu (bubble / conv) ----
function onBubbleMenu(m, e) {
  const mine = m.senderId === myId.value
  const canEdit = mine && (Date.now() - new Date(m.createdAt).getTime()) < EDIT_WINDOW_MS && !m.mediaPath
  ctx.target = { type: 'message', m }
  ctx.items = [
    { label: 'Balas', value: 'reply' },
    ...(canEdit ? [{ label: 'Edit', value: 'edit' }] : []),
    { label: 'Hapus untuk saya', value: 'delete_me' },
    { label: 'Hapus untuk semua', value: 'delete_all', danger: true },
  ]
  showCtx(e)
}
function onConvMenu(c, e) {
  ctx.target = { type: 'conv', c }
  ctx.items = [{ label: 'Hapus percakapan', value: 'delete_conv', danger: true }]
  showCtx(e)
}
function showCtx(e) {
  ctx.x = e?.clientX || (e?.touch ? window.innerWidth / 2 : 0)
  ctx.y = e?.clientY || (e?.touch ? window.innerHeight / 2 : 0)
  ctx.show = true
}
function onCtxSelect(val) {
  const t = ctx.target
  if (t?.type === 'message') {
    const m = t.m
    if (val === 'reply') startReply(m)
    else if (val === 'edit') startEdit(m)
    else if (val === 'delete_me') { m._hidden = true; deleteMessageForMe(m.id).catch(() => {}) }
    else if (val === 'delete_all') {
      m._deleted = true
      deleteMessageForAll(m.id, activeConv.value).catch(() => {})
    }
  } else if (t?.type === 'conv') {
    if (val === 'delete_conv') {
      deleteConversation(t.c.conversationId).catch(() => {})
      conv.items = conv.items.filter((x) => x.conversationId !== t.c.conversationId)
      if (activeConv.value === t.c.conversationId) closeRoom()
    }
  }
  ctx.show = false
}
function startReply(m) {
  replyingTo.value = {
    id: m.id,
    mine: m.senderId === myId.value,
    name: m.senderId === myId.value ? 'Anda' : (activePartner.value?.username || activePartner.value?.display_name),
    text: m.plaintext || '📷 foto',
  }
  focusComposer()
}
function startEdit(m) {
  editingMsg.value = m
  room.draft = m.plaintext || ''
  focusComposer()
}
function cancelReply() { replyingTo.value = null }
function cancelEdit() { editingMsg.value = null; room.draft = '' }
function jumpTo(id) {
  const el = document.getElementById('msg-' + id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// ---- settings / more menu ----
function onNavigate(target) {
  if (target === 'logout') return onLogout()
  if (target === 'settings') { ui.toggleSettings(true) }
}
async function onLogout() { await auth.logout(); location.reload() }
async function onBackup() { await auth.backup(); alert('Key dibackup ke Google Drive.') }
async function onRestore() { await auth.restore() }
async function onSaveUsername(name) { await auth.editUsername(name); await refreshProfile() }
async function onSaveDisplay(name) { await rpcUpdateDisplayName(name); await refreshProfile() }
async function onAvatar(file) { await updateAvatar(file); await refreshProfile() }
async function onDeleteAccount() {
  if (confirm('Hapus akun? Chat lawan tetap bisa dibaca. Login Gmail sama bisa kembali.')) {
    await softDeleteAccount()
    await auth.logout()
    location.reload()
  }
}
async function refreshProfile() { auth.profile = await getMyProfile() }

// visible messages (filter deleted/hidden)
const visibleMessages = computed(() => room.messages.filter((m) => !m._hidden && !m._deleted))

onMounted(async () => {
  prefs.hydrate()
  await conv.load()
  // restore last room
  try {
    const last = JSON.parse(localStorage.getItem('utext_last_room') || 'null')
    if (last?.conversationId) {
      const c = conv.byId(last.conversationId)
      if (c) onOpen(c)
    }
  } catch {}

  // auto-focus field text kalau user ngetik pakai keyboard fisik (bukan saat di input/modal lain)
  window.addEventListener('keydown', (e) => {
    if (!activeConv.value) return
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (ui.settingsOpen) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key && e.key.length === 1) {
      focusComposer()
    }
  })
})

// pass partnerOnline ke ChatHeader via wrapper
const activePartnerOnline = computed(() => room.partnerOnline)
</script>

<style scoped>
.shell { display: flex; height: 100vh; overflow: hidden; }
.pane-sidebar { width: 340px; flex: none; display: flex; flex-direction: column; border-right: 1px solid var(--border); }
.pane-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.empty-chat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--muted); gap: 8px; }
.empty-chat .em { font-size: 48px; }
@media (max-width: 720px) {
  .pane-sidebar { width: 100%; }
  .pane-chat { width: 100%; }
  .hide-mobile { display: none; }
}
</style>
