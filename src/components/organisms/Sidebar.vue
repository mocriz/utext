<template>
  <aside class="sidebar">
    <SearchBox
      v-model="q"
      :results="results"
      @search="doSearch"
      @pick="startChat"
    />
    <div class="list">
      <ChatListItem
        v-for="c in conversations"
        :key="c.conversationId"
        :conv="c"
        :active="c.conversationId === activeId"
        @open="$emit('open', c)"
        @menu="(e) => $emit('conv-menu', c, e)"
      />
      <p v-if="!conversations.length" class="empty">Belum ada percakapan. Cari username di atas.</p>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import SearchBox from '../molecules/SearchBox.vue'
import ChatListItem from '../molecules/ChatListItem.vue'
import { searchUsers, startConversationWith } from '../../lib/chat'

const props = defineProps({
  conversations: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
})
const emit = defineEmits(['open', 'conv-menu', 'new-chat'])
const q = ref('')
const results = ref([])

async function doSearch() {
  if (q.value.length < 2) return (results.value = [])
  results.value = await searchUsers(q.value)
}
async function startChat(user) {
  results.value = []
  q.value = ''
  const conv = await startConversationWith(user)
  emit('new-chat', conv)
}
</script>

<style scoped>
.sidebar {
  display: flex; flex-direction: column; height: 100%;
  background: var(--surface); border-right: 1px solid var(--border);
}
.list { flex: 1; overflow-y: auto; padding: 6px; }
.empty { color: var(--muted); font-size: 13px; text-align: center; margin-top: 24px; padding: 0 16px; }
</style>
