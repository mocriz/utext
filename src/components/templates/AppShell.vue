<template>
  <div class="shell">
    <div class="pane-sidebar" :class="{ 'hide-mobile': ui.mobileView === 'chat' }">
      <AppHeader
        :prefs="prefs"
        @navigate="onNavigate"
        @logout="onLogout"
      />
      <Sidebar
        :conversations="conv.items"
        :active-id="ui.activeRoomId"
        @open="onOpen"
        @conv-menu="onConvMenu"
        @new-chat="onNewChat"
      />
    </div>
    <div class="pane-chat" :class="{ 'hide-mobile': ui.mobileView === 'list' }">
      <ChatPanel
        v-if="activeConv && activePartner"
        :partner="activePartner"
        :messages="visibleMessages"
        :me-id="auth.user?.id"
        :typing="room.typing"
        :online="room.partnerOnline"
        :draft="room.draft"
        :preview="pendingPhoto"
        @back="closeRoom"
        @bubble-menu="onBubbleMenu"
        @update:draft="room.draft = $event"
        @typing="onTyping"
        @send="onSend"
        @pick="onPick"
        @confirm-photo="onConfirmPhoto"
        @cancel-photo="onCancelPhoto"
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
      :section="settingsSection"
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
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '../../stores/ui'
import { useAuthStore } from '../../stores/auth'
import { useConversationsStore } from '../../stores/conversations'
import { usePrefsStore } from '../../stores/prefs'
import AppHeader from '../organisms/AppHeader.vue'
import Sidebar from '../organisms/Sidebar.vue'
import ChatPanel from '../organisms/ChatPanel.vue'
import ContextMenu from '../molecules/ContextMenu.vue'
import SettingsSheet from '../organisms/SettingsSheet.vue'
import {
  loadMessages, sendText, sendPhoto, subscribeMessages,
  subscribeTyping, subscribePresence, rememberPartner, getPhoto, findExistingConversation,
} from '../../lib/chat'
import { backupToDrive, restoreFromDrive, updateUsername, getMyProfile } from '../../lib/auth'

const ui = useUiStore()
const auth = useAuthStore()
const conv = useConversationsStore()
const prefs = usePrefsStore()

const room = reactive({ messages: [], draft: '', typing: false, partnerOnline: false })
const activeConv = ref(null)
const activePartner = ref(null)
const pendingPhoto = ref(null)
const settingsSection = ref('profile')
const ctx = reactive({ show: false, items: [], x: 0, y: 0, target: null })

let typingCh = null, presenceCh = null, msgCh = null, typingTimer = null, presenceTimer = null, lastSeen = 0
const myId = computed(() => auth.user?.id)

// ---- open / switch room ----
async function onOpen(c) {
  activeConv.value = c.conversationId
  activePartner.value = c.partner
  ui.openRoom(c.conversationId)
  conv.clearUnread(c.conversationId)
  rememberPartner(c.conversationId, c.partner.id) // WAJIB sebelum loadMessages/subscribe
  room.messages = await loadMessages(c.conversationId)
  msgCh?.()
  msgCh = subscribeMessages(c.conversationId, (m) => {
    room.messages.push(m)
    if (m.senderId !== myId.value) conv.bumpUnread(c.conversationId)
  })
  setupTyping(c.conversationId)
  setupPresence(c.conversationId)
  // decrypt foto yg ada
  for (const m of room.messages) if (m.mediaPath) await preload(m)
}
function onNewChat(c) { onOpen(c) }

// ---- close room -> desktop: clear selection (sidebar tetap); mobile: balik list ----
function closeRoom() {
  ui.closeRoom()
  activeConv.value = null
  activePartner.value = null
  room.messages = []
  room.typing = false
  msgCh?.(); msgCh = null
  typingCh?.(); typingCh = null
  presenceCh?.(); presenceCh = null
  clearInterval(presenceTimer)
  clearTimeout(typingTimer)
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

// ---- send ----
async function onSend() {
  const text = room.draft.trim()
  if (!text || !activeConv.value) return
  room.draft = ''
  // pastikan conversation ada (startConversationWith lazy)
  let cid = activeConv.value
  if (!cid) {
    cid = await findExistingConversation(activePartner.value.id)
    if (!cid) cid = (await import('../../lib/chat')).startConversationWith(activePartner.value)
    activeConv.value = cid
  }
  await sendText(cid, activePartner.value.id, text)
  room.messages.push({ id: crypto.randomUUID(), senderId: myId.value, plaintext: text, time: now(), receipt: 'sent' })
}
function now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

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
  ctx.target = { type: 'message', m }
  ctx.items = [
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
    if (val === 'delete_me') t.m._hidden = true
    else if (val === 'delete_all') t.m._deleted = true // TODO Phase F: DB delete
  } else if (t?.type === 'conv') {
    if (val === 'delete_conv') conv.items = conv.items.filter((x) => x.conversationId !== t.c.conversationId) // TODO Phase F: DB
  }
  ctx.show = false
}

// ---- settings / more menu ----
function onNavigate(target) {
  if (target === 'logout') return onLogout()
  if (target === 'profile') { settingsSection.value = 'profile'; ui.toggleSettings(true) }
  else if (target === 'account') { settingsSection.value = 'account'; ui.toggleSettings(true) }
  else if (target.startsWith('settings')) { settingsSection.value = 'settings'; ui.toggleSettings(true) }
}
async function onLogout() { await auth.logout(); location.reload() }
async function onBackup() { await auth.backup(); alert('Key dibackup ke Google Drive.') }
async function onRestore() { await auth.restore() }
async function onSaveUsername(name) { await auth.editUsername(name); await refreshProfile() }
async function onSaveDisplay(name) { /* TODO Phase F: update display_name */ await refreshProfile() }
async function onAvatar(file) { /* TODO Phase F: upload avatar */ }
async function onDeleteAccount() { /* TODO Phase F: soft delete */ alert('Fitur hapus akun menyusul (Phase F).') }
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
