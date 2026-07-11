<template>
  <header class="app-header">
    <div class="brand">
      <span class="logo">🔐</span>
      <span class="name">utext</span>
    </div>
    <div class="right">
      <IconButton :icon="theme.mode === 'dark' ? '☀️' : '🌙'"
        :title="theme.mode === 'dark' ? 'Light mode' : 'Dark mode'"
        @click="theme.toggle()" />
      <MoreMenu :settings="prefs" @navigate="$emit('navigate', $event)" @logout="$emit('logout')" />
    </div>
  </header>
</template>

<script setup>
import { useThemeStore } from '../../stores/theme'
import IconButton from '../atoms/IconButton.vue'
import MoreMenu from '../molecules/MoreMenu.vue'

const theme = useThemeStore()
defineProps({
  // mirror preferences buat MoreMenu toggle labels
  prefs: { type: Object, default: () => ({ readReceipt: true, onlineIndicator: true }) },
})
defineEmits(['navigate', 'logout'])
</script>

<style scoped>
.app-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.brand { display: flex; align-items: center; gap: 8px; }
.logo { font-size: 20px; }
.name { font-weight: 700; font-size: 16px; letter-spacing: .02em; }
.right { display: flex; align-items: center; gap: 4px; }
</style>
