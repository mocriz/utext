<template>
  <div
    class="chat-item"
    :class="{ active }"
    @click="$emit('open')"
    @contextmenu.prevent="$emit('menu', $event)"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <Avatar :src="conv.partner?.avatar_url" :name="conv.partner?.username || conv.partner?.display_name" />
    <div class="mid">
      <div class="row">
        <span class="name">{{conv.partner?.display_name }}</span>
        <span class="time">{{ conv.lastTime }}</span>
      </div>
      <div class="row">
        <span class="last">{{ conv.lastMessage || 'Belum ada pesan' }}</span>
        <span v-if="conv.unread" class="badge">{{ conv.unread }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import Avatar from '../atoms/Avatar.vue'
const props = defineProps({
  conv: { type: Object, required: true },
  active: { type: Boolean, default: false },
})
const emit = defineEmits(['open', 'menu'])
let timer = null
function onTouchStart() { timer = setTimeout(() => emit('menu', { touch: true }), 550) }
function onTouchEnd() { clearTimeout(timer) }
</script>

<style scoped>
.chat-item {
  display: flex; gap: 12px; align-items: center;
  padding: 10px 14px; cursor: pointer; border-radius: var(--radius-sm);
}
.chat-item:hover { background: var(--surface-2); }
.chat-item.active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.mid { flex: 1; min-width: 0; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.name { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.time { font-size: 11px; color: var(--muted); flex: none; }
.last { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge {
  flex: none; min-width: 20px; height: 20px; padding: 0 6px;
  border-radius: 10px; background: var(--accent); color: var(--accent-fg);
  font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
}
</style>
