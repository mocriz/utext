<template>
  <header class="chat-header">
    <IconButton icon="✕" title="Tutup chat" class="close" @click="$emit('back')" />
    <Avatar :src="partner.avatar_url" :name="partner.username || partner.display_name" size="md" />
    <div class="info">
      <div class="name">{{ partner.display_name }}</div>
      <div class="status">
        <span v-if="typing" class="typing">
          <span class="tdot" /><span class="tdot" /><span class="tdot" />
          mengetik…
        </span>
        <span v-else-if="online" class="online">Online</span>
        <span v-else class="offline">{{ lastSeenText }}</span>
      </div>
    </div>
  </header>
</template>

<script setup>
import IconButton from '../atoms/IconButton.vue'
import Avatar from '../atoms/Avatar.vue'

const props = defineProps({
  partner: { type: Object, required: true },
  online: { type: Boolean, default: false },
  typing: { type: Boolean, default: false },
  lastSeen: { type: Number, default: 0 }, // epoch ms
})
defineEmits(['back'])

function fmt(ts) {
  if (!ts) return 'Offline'
  const diff = Date.now() - ts
  if (diff < 60000) return 'Baru saja'
  if (diff < 3600000) return `Terakhir dilihat ${Math.floor(diff / 60000)}m lalu`
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `Terakhir dilihat ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  return `Terakhir dilihat ${d.getDate()}/${d.getMonth() + 1}`
}
const lastSeenText = fmt(props.lastSeen)
</script>

<style scoped>
.chat-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.back { display: none; }
.close { display: inline-flex; }
.info { display: flex; flex-direction: column; }
.name { font-weight: 600; font-size: 15px; }
.status { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); }
.online { color: #16a34a; }
.offline { color: var(--muted); }
.typing { display: inline-flex; align-items: center; gap: 3px; color: var(--accent); font-style: italic; }
.tdot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); animation: tdot 1s infinite ease-in-out; }
.tdot:nth-child(2) { animation-delay: .15s; }
.tdot:nth-child(3) { animation-delay: .3s; }
@keyframes tdot { 0%, 80%, 100% { opacity: .25; transform: scale(.8); } 40% { opacity: 1; transform: scale(1); } }
@media (max-width: 720px) { .back { display: inline-flex; } }
</style>
