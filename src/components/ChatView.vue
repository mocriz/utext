<!-- src/components/ChatView.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  searchUsers, startConversationWith, listConversations, loadMessages,
  sendText, sendPhoto, subscribeMessages, rememberPartner, getPhoto,
} from '../lib/chat'
import { getSession, getMyProfile, updateUsername, logout } from '../lib/auth'

const me = getSession().userId
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

onMounted(async () => {
  const p = await getMyProfile()
  myUsername.value = p?.username || ''
  conversations.value = await listConversations()
})

onUnmounted(() => unsub.value?.())

async function saveUsername() {
  try {
    await updateUsername(newUsername.value.trim())
    myUsername.value = newUsername.value.trim()
    editing.value = false
  } catch (e) { alert('Gagal: ' + e.message) }
}

async function doSearch() {
  if (searchQ.value.length < 2) return
  searchResults.value = await searchUsers(searchQ.value)
}

async function openConversation(conv) {
  activeConv.value = conv.conversationId
  partner.value = conv.partner
  rememberPartner(conv.conversationId, conv.partner.id)
  messages.value = await loadMessages(conv.conversationId)
  unsub.value?.()
  unsub.value = subscribeMessages(conv.conversationId, (m) => messages.value.push(m))
}

async function startChat(user) {
  const cid = await startConversationWith(user.id)
  const conv = { conversationId: cid, partner: user }
  conversations.value.push(conv)
  searchResults.value = []
  searchQ.value = ''
  await openConversation(conv)
}

async function send() {
  if (!draft.value.trim() || !activeConv.value) return
  const text = draft.value
  draft.value = ''
  await sendText(activeConv.value, partner.value.id, text)
  messages.value.push({ id: crypto.randomUUID(), senderId: me, plaintext: text, createdAt: new Date().toISOString() })
}

async function onPickPhoto(e) {
  const file = e.target.files?.[0]
  if (!file || !activeConv.value) return
  await sendPhoto(activeConv.value, partner.value.id, file)
  e.target.value = ''
}

async function photoUrl(m) {
  if (!m.mediaPath) return null
  const bytes = await getPhoto(activeConv.value, partner.value.id, m.mediaPath, m.media_iv)
  return URL.createObjectURL(new Blob([bytes]))
}
</script>

<template>
  <div class="chat">
    <aside>
      <div class="me-box">
        <span v-if="!editing">@{{ myUsername }}</span>
        <input v-else v-model="newUsername" @keyup.enter="saveUsername" placeholder="new username" />
        <button v-if="!editing" @click="editing = true; newUsername = myUsername">edit</button>
        <button v-else @click="saveUsername">save</button>
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
    <main v-if="activeConv">
      <header>@{{ partner?.username || partner?.display_name }}</header>
      <div class="msgs">
        <div v-for="m in messages" :key="m.id" :class="['bubble', m.senderId === me ? 'me' : 'them']">
          <template v-if="m.plaintext">{{ m.plaintext }}</template>
          <img v-else-if="m.mediaPath" :src="photoUrl(m)" class="photo" />
        </div>
      </div>
      <form @submit.prevent="send">
        <input type="file" accept="image/*" ref="photoInput" @change="onPickPhoto" hidden />
        <button type="button" @click="photoInput?.click()">📷</button>
        <input v-model="draft" placeholder="Type…" />
        <button type="submit">Send</button>
      </form>
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
form { display: flex; padding: 8px; gap: 8px; border-top: 1px solid #ddd; }
form input[type=text], form input:not([type=file]):not([type=button]) { flex: 1; padding: 8px; }
</style>
