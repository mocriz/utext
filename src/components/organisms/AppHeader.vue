<template>
  <header class="app-header">
    <div class="left">
      <IconButton icon="⌕" title="Cari" class="search" @click="$emit('search')" />
      <span class="brand">utext</span>
    </div>
    <div class="right">
      <MoreMenu :settings="prefs" @navigate="$emit('navigate', $event)" @logout="$emit('logout')" />
    </div>
  </header>
</template>

<script setup>
import IconButton from '../atoms/IconButton.vue'
import MoreMenu from '../molecules/MoreMenu.vue'

defineProps({
  prefs: { type: Object, default: () => ({ readReceipt: true, onlineIndicator: true }) },
})
defineEmits(['search', 'navigate', 'logout'])
</script>

<style scoped>
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.left { display: flex; align-items: center; gap: 6px; }
.brand { font-weight: 700; font-size: 16px; letter-spacing: .02em; }
.right { display: flex; align-items: center; gap: 4px; }
</style>
