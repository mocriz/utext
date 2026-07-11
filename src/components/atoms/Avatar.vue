<template>
  <span class="avatar" :class="size" :style="bg">
    <img v-if="src" :src="src" :alt="alt" @error="onErr" />
    <span v-else class="initials">{{ initials }}</span>
  </span>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
  color: { type: String, default: '' },
})
const alt = computed(() => props.name || 'avatar')
const initials = computed(() => (props.name || '?').trim().slice(0, 2).toUpperCase())
const bg = computed(() => props.color ? { background: props.color } : {})
const failed = ref(false)
function onErr() { failed.value = true }
</script>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent);
  color: var(--accent-fg);
  font-weight: 600;
  flex: none;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.initials { font-size: .8em; }
.sm { width: 32px; height: 32px; font-size: 13px; }
.md { width: 42px; height: 42px; font-size: 15px; }
.lg { width: 64px; height: 64px; font-size: 22px; }
</style>
