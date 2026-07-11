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
        <template v-else>
          <StatusDot :on="online" />
          <span>{{ online ? 'online' : 'offline' }}</span>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup>
import IconButton from '../atoms/IconButton.vue'
import Avatar from '../atoms/Avatar.vue'
import StatusDot from '../atoms/StatusDot.vue'

defineProps({
  partner: { type: Object, required: true },
  online: { type: Boolean, default: false },
  typing: { type: Boolean, default: false },
})
defineEmits(['back'])
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
.typing { display: inline-flex; align-items: center; gap: 3px; color: var(--accent); font-style: italic; }
.tdot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); animation: tdot 1s infinite ease-in-out; }
.tdot:nth-child(2) { animation-delay: .15s; }
.tdot:nth-child(3) { animation-delay: .3s; }
@keyframes tdot { 0%, 80%, 100% { opacity: .25; transform: scale(.8); } 40% { opacity: 1; transform: scale(1); } }
@media (max-width: 720px) { .back { display: inline-flex; } }
</style>
