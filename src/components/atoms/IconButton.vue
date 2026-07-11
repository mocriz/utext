<template>
  <button class="icon-btn" :class="size" :title="title" :type="type" @click="$emit('click', $event)">
    <slot>{{ icon }}</slot>
  </button>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
  type: { type: String, default: 'button' },
})
defineEmits(['click'])
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
