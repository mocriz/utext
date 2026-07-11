<template>
  <span class="spinner" :class="size" />
</template>

<script setup>
defineProps({
  size: { type: String, default: 'md' }, // sm | md | lg
})
</script>

<style scoped>
.spinner {
  display: inline-block;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
.sm { width: 14px; height: 14px; }
.md { width: 20px; height: 20px; }
.lg { width: 30px; height: 30px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
