<template>
  <header class="app-header">
    <div class="left">
      <Avatar :src="profile?.avatar_url" :name="profile?.username || profile?.display_name" size="sm" />
    </div>
    <div class="center">uText</div>
    <div class="right">
      <IconButton icon="⌕" title="Cari" class="search" @click="$emit('search')" />
      <MoreMenu :settings="prefs" @navigate="$emit('navigate', $event)" @logout="$emit('logout')" />
    </div>
  </header>
</template>

<script setup>
import IconButton from '../atoms/IconButton.vue'
import Avatar from '../atoms/Avatar.vue'
import MoreMenu from '../molecules/MoreMenu.vue'

defineProps({
  profile: { type: Object, default: null },
  prefs: { type: Object, default: () => ({ readReceipt: true, onlineIndicator: true }) },
})
defineEmits(['search', 'navigate', 'logout'])
</script>

<style scoped>
.app-header {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.left { justify-self: start; }
.center { justify-self: center; font-weight: 700; font-size: 16px; letter-spacing: .04em; }
.right { justify-self: end; display: flex; align-items: center; gap: 2px; }
</style>
