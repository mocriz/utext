<template>
  <header class="chat-header">
    <IconButton icon="✕" title="Tutup chat" class="close" @click="$emit('back')" />
    <Avatar :src="partner.avatar_url" :name="partner.username || partner.display_name" size="md" />
    <div class="info">
      <div class="name">{{ partner.display_name }}</div>
      <div class="status">
        <StatusDot :on="online" />
        <span>{{ online ? 'online' : 'offline' }}</span>
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
@media (max-width: 720px) { .back { display: inline-flex; } }
</style>
