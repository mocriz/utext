<template>
  <div class="more" v-click-outside="close">
    <IconButton name="mdi:dots-vertical" title="Menu" @click="open = !open" />
    <div v-if="open" class="menu">
      <button class="mi" @click="go('settings')">
        <Icon name="mdi:cog-outline" :size="18" />
        Pengaturan
      </button>
      <div class="sep" />
      <button class="mi danger" @click="go('logout')">
        <Icon name="mdi:logout" :size="18" />
        Keluar
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import IconButton from '../atoms/IconButton.vue'
import Icon from '../atoms/Icon.vue'

const emit = defineEmits(['navigate', 'logout'])
const open = ref(false)
function close() { open.value = false }
function go(target) { open.value = false; emit('navigate', target) }

const vClickOutside = {
  mounted(el, binding) {
    el._h = (e) => { if (!el.contains(e.target)) binding.value() }
    document.addEventListener('click', el._h)
  },
  unmounted(el) { document.removeEventListener('click', el._h) },
}
</script>

<style scoped>
.more { position: relative; }
.menu {
  position: absolute; right: 0; top: 44px; z-index: 50;
  min-width: 200px; padding: 6px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow);
}
.mi {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 10px 12px; border: none; background: transparent;
  color: var(--fg); font-size: 14px; text-align: left; cursor: pointer; border-radius: var(--radius-sm);
}
.mi svg { width: 18px; height: 18px; }
.mi:hover { background: var(--surface-2); }
.mi.danger { color: var(--danger); }
.sep { height: 1px; background: var(--border); margin: 4px 0; }
</style>
