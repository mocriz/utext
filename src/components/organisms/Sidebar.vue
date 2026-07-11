<template>
  <aside class="sidebar">
    <!-- mode cari: hasil user -->
    <div v-if="searching" class="list">
      <UserListItem
        v-for="u in results"
        :key="u.id"
        :user="u"
        @click="$emit('pick-user', u)"
      />
      <p v-if="query.length >= 2 && !results.length" class="empty">Tidak ada user ditemukan.</p>
      <p v-else-if="query.length < 2" class="empty">Ketik minimal 2 huruf untuk mencari.</p>
    </div>

    <!-- mode normal: daftar percakapan -->
    <div v-else class="list">
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
import ChatListItem from '../molecules/ChatListItem.vue'
import UserListItem from '../molecules/UserListItem.vue'

defineProps({
  conversations: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
  searching: { type: Boolean, default: false },
  results: { type: Array, default: () => [] },
  query: { type: String, default: '' },
})
defineEmits(['open', 'conv-menu', 'pick-user'])
</script>

<style scoped>
.sidebar {
  display: flex; flex-direction: column; height: 100%;
  background: var(--surface); border-right: 1px solid var(--border);
}
.list { flex: 1; overflow-y: auto; padding: 6px; }
.empty { color: var(--muted); font-size: 13px; text-align: center; margin-top: 24px; padding: 0 16px; }
</style>
