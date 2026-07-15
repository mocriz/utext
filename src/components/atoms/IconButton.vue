<template>
  <button class="icon-btn" :class="size" :title="title" :type="type" @click="$emit('click', $event)">
    <Icon v-if="name" :name="name" :size="iconSize" />
    <slot v-else>{{ icon }}</slot>
  </button>
</template>

<script setup>
import Icon from './Icon.vue'

defineProps({
  icon: { type: String, default: '' },
  name: { type: String, default: '' }, // iconify name, misal 'mdi:close'
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
  type: { type: String, default: 'button' },
})
defineEmits(['click'])

const sizes = { sm: 16, md: 20, lg: 24 }
const iconSize = sizes['md']
</script>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: 50%;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.icon-btn:hover { background: var(--surface-2); color: var(--fg); }
.md { width: 38px; height: 38px; font-size: 18px; }
.sm { width: 30px; height: 30px; font-size: 15px; }
.lg { width: 46px; height: 46px; font-size: 22px; }
</style>
