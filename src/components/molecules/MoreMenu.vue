<template>
  <div class="more" v-click-outside="close">
    <IconButton icon="⋮" title="Menu" @click="open = !open" />
    <div v-if="open" class="menu">
      <button class="mi" @click="go('profile')">👤 Profil</button>
      <button class="mi" @click="go('account')">⚙️ Akun</button>
      <div class="sep" />
      <div class="mh">Pengaturan</div>
      <button class="mi" @click="go('settings:backup')">💾 Backup Key</button>
      <button class="mi" @click="go('settings:readreceipt')">
        ✓ Read Receipt <span class="val">{{ settings.readReceipt ? 'ON' : 'OFF' }}</span>
      </button>
      <button class="mi" @click="go('settings:online')">
        🟢 Online Indicator <span class="val">{{ settings.onlineIndicator ? 'ON' : 'OFF' }}</span>
      </button>
      <button class="mi" @click="go('settings:theme')">🎨 Theme</button>
      <div class="sep" />
      <button class="mi danger" @click="go('logout')">⏻ Logout</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import IconButton from '../atoms/IconButton.vue'

const props = defineProps({
  settings: { type: Object, default: () => ({ readReceipt: true, onlineIndicator: true }) },
})
const emit = defineEmits(['navigate', 'logout'])
const open = ref(false)
function close() { open.value = false }
function go(target) { open.value = false; emit('navigate', target) }

// directive: klik di luar nutup menu
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
  min-width: 220px; padding: 6px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow);
}
.mi {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  width: 100%; padding: 9px 10px; border: none; background: transparent;
  color: var(--fg); font-size: 14px; text-align: left; cursor: pointer; border-radius: var(--radius-sm);
}
.mi:hover { background: var(--surface-2); }
.mi.danger { color: var(--danger); }
.mh { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 8px 10px 4px; }
.sep { height: 1px; background: var(--border); margin: 4px 0; }
.val { font-size: 11px; color: var(--muted); }
</style>
