<template>
  <div class="shell">
    <div class="pane-sidebar" :class="{ 'hide-mobile': ui.mobileView === 'chat' }" :style="{ width: sidebarWidth + 'px' }">
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
    <!-- divider resize horizontal (desktop) -->
    <div
      v-if="!isMobile"
      class="divider"
      @mousedown.prevent="startResize"
      @touchstart.prevent="startResize"
    />
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
        @open-media="(src) => (viewerSrc = src)"
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

    <ConfirmDialog ref="confirmDialog" />
    <MediaViewer :src="viewerSrc" @close="viewerSrc = ''" />
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, watch, nextTick } from 'vue'
import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'
import { useConversationsStore } from '../../stores/conversations'
import { usePrefsStore } from '../../stores/prefs'
import { useToastStore } from '../../stores/toast'
import { supabase } from '../../lib/supabase'
import AppHeader from '../organisms/AppHeader.vue'
import Sidebar from '../organisms/Sidebar.vue'
import ChatPanel from '../organisms/ChatPanel.vue'
import ContextMenu from '../molecules/ContextMenu.vue'
import SettingsSheet from '../organisms/SettingsSheet.vue'
import ConfirmDialog from '../atoms/ConfirmDialog.vue'
import MediaViewer from '../atoms/MediaViewer.vue'
import {
  loadMessages, sendText, sendPhoto, subscribeMessages, editMessage,
  subscribeTyping, subscribePresence, rememberPartner, getPhoto, findExistingConversation,
  deleteConversation, deleteMessageForMe, deleteMessageForAll, deleteConversationForAll, markDelivered, markRead,
  getLastSeen, touchLastSeen,
  updateDisplayName as rpcUpdateDisplayName, uploadAvatar, searchUsers, startConversationWith,
} from '../../lib/chat'
import { backupToDrive, restoreFromDrive, updateUsername, getMyProfile, updateDisplayName, updateAvatar, softDeleteAccount } from '../../lib/auth'

const ui = useUiStore()
const auth = useAuthStore()
const conv = useConversationsStore()
const prefs = usePrefsStore()
const toast = useToastStore()

const room = reactive({ messages: [], draft: '', typing: false, partnerOnline: false })
const activeConv = ref(null)
const activePartner = ref(null)
const pendingPhoto = ref(null)
const settingsSection = ref('profile')
const chatPanel = ref(null)
const confirmDialog = ref(null)
const viewerSrc = ref('')
const ctx = reactive({ show: false, items: [], x: 0, y: 0, target: null })

// sidebar width (resize horizontal) — persist ke localStorage, range 350-700
const sidebarWidth = ref(Math.min(Math.max(Number(localStorage.getItem('utext_sidebar_w') || 340), 350), 700))
const isMobile = ref(window.innerWidth <= 720)
function onResizeWindow() { isMobile.value = window.innerWidth <= 720 }
window.addEventListener('resize', onResizeWindow)
let resizing = false
function startResize() {
  resizing = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopResize)
  window.addEventListener('touchmove', onDrag, { passive: false })
  window.addEventListener('touchend', stopResize)
}
function onDrag(e) {
  if (!resizing) return
  const x = e.touches ? e.touches[0].clientX : e.clientX
  const w = Math.min(Math.max(x, 350), 700)
  sidebarWidth.value = w
}
function stopResize() {
  resizing = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  localStorage.setItem('utext_sidebar_w', String(sidebarWidth.value))
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopResize)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('touchend', stopResize)
}

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
  localStorage.setItem('utext_active_conv', JSON.stringify({ conversationId: c.conversationId }))
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
    // pesan partner masuk -> kita langsung tandai read di LOCAL (optimistic, ga nunggu RPC)
    if (m.senderId !== myId.value) {
      conv.bumpUnread(c.conversationId)
      markReadLocal(c.conversationId)
      if (prefs.readReceipt) markRead(c.conversationId)
      else markDelivered(c.conversationId)
    }
  }, (u) => {
    // pesan dihapus untuk semua -> hide realtime (tanpa refresh)
    const existing = room.messages.find((x) => x.id === u.id)
    if (existing) existing._deleted = true
  })
  // tandai pesan partner sebagai read/delivered pas room dibuka (SEKALI, local dulu)
  if (!markedReadFor.has(c.conversationId)) {
    markedReadFor.add(c.conversationId)
    markReadLocal(c.conversationId)
    if (prefs.readReceipt) markRead(c.conversationId)
    else markDelivered(c.conversationId)
  }
  // update receipt lokal pesan kita yang dikirim sebelumnya (dari DB lawan)
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

// Tandai semua pesan partner di room ini sebagai read di LOCAL (langsung 2 biru, ga nunggu RPC)
function markReadLocal(cid) {
  for (const m of room.messages) {
    if (m.senderId !== myId.value && m.receipt !== 'read') m.receipt = 'read'
  }
}
function onNewChat(c) { onOpen(c) }

// ---- search user ----
function openSearch() { searching.value = true }
function closeSearch() { searching.value = false; searchQuery.value = ''; searchResults.value = [] }
function onSearchInput(q) {
  searchQuery.value = q
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (q.length < 1) return (searchResults.value = [])
    searchResults.value = await searchUsers(q)
  }, 250)
}
async function startChat(user) {
  searching.value = false
  searchQuery.value = ''
  searchResults.value = []
  try {
    const c = await startConversationWith(user)
    await conv.load()
    const convItem = conv.byId(c)
    if (convItem) onOpen(convItem)
    else toast.error('Gagal buka percakapan')
  } catch (e) { toast.error('Gagal memulai chat: ' + e.message) }
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
  presenceCh?.unsubscribe(); presenceCh = null
  clearInterval(presenceTimer)
  clearInterval(receiptTimer)
  clearTimeout(typingTimer)
  markedReadFor.clear()
  seenMsgIds.clear()
  localStorage.removeItem('utext_active_conv')
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
// Kombinasi: Presence (realtime) + fallback DB last_seen (lebih reliable)
function setupPresence(cid) {
  presenceCh?.unsubscribe()
  lastSeen = 0
  const partnerId = activePartner.value?.id
  // Presence realtime
  presenceCh = subscribePresence(cid, myId.value, (state) => {
    const others = Object.values(state).flat().filter((p) => p.userId && p.userId !== myId.value)
    if (others.length) {
      const max = Math.max(0, ...others.map((p) => p.online_at || 0))
      lastSeen = max
      room.partnerOnline = Date.now() - lastSeen < 30000
    }
  })
  // kita heartbeat biar lawan liat kita online
  touchLastSeen()
  clearInterval(presenceTimer)
  presenceTimer = setInterval(async () => {
    touchLastSeen() // update last_seen kita
    // fallback: cek last_seen partner dari DB
    if (partnerId) {
      const ts = await getLastSeen(partnerId)
      if (ts) {
        lastSeen = ts
        room.partnerOnline = Date.now() - ts < 60000 // 1 menit threshold (DB lebih lambat dari presence)
      } else {
        room.partnerOnline = false
      }
    }
  }, 5000)
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
  if (mine) {
    // pesan sendiri: bisa hapus untuk semua
    ctx.items = [
      { label: 'Balas', value: 'reply' },
      ...(canEdit ? [{ label: 'Edit', value: 'edit' }] : []),
      { label: 'Hapus untuk saya', value: 'delete_me' },
      { label: 'Hapus untuk semua', value: 'delete_all', danger: true },
    ]
  } else {
    // pesan lawan: cuma bisa hapus untuk saya
    ctx.items = [
      { label: 'Balas', value: 'reply' },
      { label: 'Hapus untuk saya', value: 'delete_me' },
    ]
  }
  showCtx(e)
}
function onConvMenu(c, e) {
  ctx.target = { type: 'conv', c }
  ctx.items = [
    { label: 'Hapus untuk saya', value: 'delete_conv_me' },
    { label: 'Hapus untuk semua', value: 'delete_conv_all', danger: true },
  ]
  showCtx(e)
}
function showCtx(e) {
  ctx.x = e?.clientX || (e?.touch ? window.innerWidth / 2 : 0)
  ctx.y = e?.clientY || (e?.touch ? window.innerHeight / 2 : 0)
  ctx.show = true
}
async function onCtxSelect(val) {
  const t = ctx.target
  if (t?.type === 'message') {
    const m = t.m
    if (val === 'reply') startReply(m)
    else if (val === 'edit') startEdit(m)
    else if (val === 'delete_me') {
      m._hidden = true
      try { await deleteMessageForMe(m.id); toast.success('Pesan dihapus untuk Anda') }
      catch (e) { toast.error('Gagal hapus: ' + e.message) }
    }
    else if (val === 'delete_all') {
      m._deleted = true
      try { await deleteMessageForAll(m.id, activeConv.value); toast.success('Pesan dihapus untuk semua') }
      catch (e) { toast.error('Gagal hapus: ' + e.message) }
    }
  } else if (t?.type === 'conv') {
    if (val === 'delete_conv_me') {
      try {
        await deleteConversation(t.c.conversationId)
        conv.items = conv.items.filter((x) => x.conversationId !== t.c.conversationId)
        if (activeConv.value === t.c.conversationId) closeRoom()
        toast.success('Percakapan dihapus untuk Anda')
      } catch (e) { toast.error('Gagal hapus: ' + e.message) }
    } else if (val === 'delete_conv_all') {
      const ok = await confirmDialog.value.open({
        title: 'Hapus untuk semua?',
        message: 'Percakapan dan semua pesan akan dihapus permanen. Lawan kehilangan semua chat ini.',
        confirmText: 'Hapus semua',
        danger: true,
      })
      if (!ok) return
      try {
        await deleteConversationForAll(t.c.conversationId)
        conv.items = conv.items.filter((x) => x.conversationId !== t.c.conversationId)
        if (activeConv.value === t.c.conversationId) closeRoom()
        toast.success('Percakapan dihapus untuk semua')
      } catch (e) { toast.error('Gagal hapus: ' + e.message) }
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
async function onBackup() {
  try { await auth.backup(); toast.success('Key dibackup ke Google Drive') }
  catch (e) { toast.error('Backup gagal: ' + e.message) }
}
async function onRestore() {
  try { await auth.restore(); toast.success('Key dipulihkan dari Drive') }
  catch (e) { toast.error('Restore gagal: ' + e.message) }
}
async function onSaveUsername(name) {
  try { await auth.editUsername(name); await refreshProfile(); toast.success('Username disimpan') }
  catch (e) { toast.error('Gagal: ' + e.message) }
}
async function onSaveDisplay(name) {
  try { await rpcUpdateDisplayName(name); await refreshProfile(); toast.success('Nama tampilan disimpan') }
  catch (e) { toast.error('Gagal: ' + e.message) }
}
async function onAvatar(file) {
  try { await updateAvatar(file); await refreshProfile(); toast.success('Foto profil diperbarui') }
  catch (e) { toast.error('Gagal upload: ' + e.message) }
}
async function onDeleteAccount() {
  const ok = await confirmDialog.value.open({
    title: 'Hapus akun?',
    message: 'Chat lawan tetap bisa dibaca. Login Gmail sama bisa kembali.',
    confirmText: 'Hapus akun',
    danger: true,
  })
  if (!ok) return
  try {
    await softDeleteAccount()
    await auth.logout()
    location.reload()
  } catch (e) { toast.error('Gagal hapus akun: ' + e.message) }
}
async function refreshProfile() { auth.profile = await getMyProfile() }

// visible messages (filter deleted/hidden)
const visibleMessages = computed(() => room.messages.filter((m) => !m._hidden && !m._deleted))

onMounted(async () => {
  prefs.hydrate()
  await conv.load()
  // restore last room (biar ga ilang pas refresh)
  try {
    const last = JSON.parse(localStorage.getItem('utext_active_conv') || 'null')
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
.pane-sidebar { flex: none; display: flex; flex-direction: column; border-right: 1px solid var(--border); min-width: 0; }
.pane-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.divider { width: 5px; flex: none; cursor: col-resize; background: transparent; transition: background .15s; }
.divider:hover { background: var(--accent); }
.empty-chat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--muted); gap: 8px; }
.empty-chat .em { font-size: 48px; }
@media (max-width: 720px) {
  .pane-sidebar { width: 100%; }
  .pane-chat { width: 100%; }
  .hide-mobile { display: none; }
}
</style>
