<template>
  <div class="more" v-click-outside="close">
    <IconButton icon="⋮" title="Menu" @click="open = !open" />
    <div v-if="open" class="menu">
      <button class="mi" @click="go('settings')">
        <svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4l-2 1.5.5 2.5-2 1.5-2.5-.5L13 21h-2l-1-2.5-2.5.5-2-1.5.5-2.5L3 12l2-1.5L4.5 8l2-1.5L9 7l1-2.5h2L13 7l2.5-.5 2 1.5-.5 2.5L21 12z" /></svg>
        Pengaturan
      </button>
      <div class="sep" />
      <button class="mi danger" @click="go('logout')">
        <svg viewBox="0 0 24 24"><path d="M16 13v-2H7V8l-4 4 4 4v-3h9zM20 3H4v4h2V5h12v14H6v-2H4v4h16V3z" /></svg>
        Logout
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import IconButton from '../atoms/IconButton.vue'

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
.mi svg { width: 18px; height: 18px; fill: currentColor; }
.mi:hover { background: var(--surface-2); }
.mi.danger { color: var(--danger); }
.sep { height: 1px; background: var(--border); margin: 4px 0; }
</style>
