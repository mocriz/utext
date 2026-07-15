<template>
  <header class="app-header" :class="{ searching }">
    <!-- mode search: full-width input -->
    <template v-if="searching">
      <IconButton name="mdi:close" title="Tutup cari" class="close-search" @click="$emit('close-search')" />
      <input
        ref="input"
        class="search-input"
        :value="query"
        placeholder="Cari username…"
        @input="$emit('update:query', $event.target.value)"
        @keyup.esc="$emit('close-search')"
      />
    </template>

    <!-- mode normal -->
    <template v-else>
      <div class="left">
        <Avatar :src="profile?.avatar_url" :name="profile?.display_name || profile?.username" size="sm" />
      </div>
      <div class="center">uText</div>
      <div class="right">
        <IconButton name="mdi:magnify" title="Cari" class="search" @click="$emit('open-search')" />
        <MoreMenu :settings="prefs" @navigate="$emit('navigate', $event)" @logout="$emit('logout')" />
      </div>
    </template>
  </header>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import IconButton from '../atoms/IconButton.vue'
import Avatar from '../atoms/Avatar.vue'
import MoreMenu from '../molecules/MoreMenu.vue'

const props = defineProps({
  profile: { type: Object, default: null },
  prefs: { type: Object, default: () => ({ readReceipt: true, onlineIndicator: true }) },
  searching: { type: Boolean, default: false },
  query: { type: String, default: '' },
})
const emit = defineEmits(['open-search', 'close-search', 'update:query', 'navigate', 'logout'])
const input = ref(null)

// auto-focus pas mode search nyala
watch(() => props.searching, (v) => { if (v) nextTick(() => input.value?.focus()) })
</script>

<style scoped>
.app-header {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.app-header.searching { display: flex; gap: 8px; }
.left { justify-self: start; }
.center { justify-self: center; font-weight: 700; font-size: 16px; letter-spacing: .04em; }
.right { justify-self: end; display: flex; align-items: center; gap: 2px; }
.search-input {
  flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg); color: var(--fg); font-size: 14px; outline: none;
}
.search-input:focus { border-color: var(--accent); }
</style>
