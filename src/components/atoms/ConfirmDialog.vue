<template>
  <teleport to="body">
    <div v-if="state.show" class="confirm-backdrop" @click="cancel">
      <div class="confirm" @click.stop>
        <div class="title">{{ state.title }}</div>
        <div class="msg">{{ state.message }}</div>
        <div class="actions">
          <button class="btn ghost" @click="cancel">Batal</button>
          <button class="btn danger" :class="{ danger: state.danger }" @click="ok">{{ state.confirmText || 'Ya' }}</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { reactive } from 'vue'

// cara pakai: const ok = await confirmDialog({ title, message, danger })
// returns Promise<boolean>
const state = reactive({ show: false, title: '', message: '', confirmText: 'Ya', danger: false })
let resolver = null

function open(opts = {}) {
  state.title = opts.title || 'Konfirmasi'
  state.message = opts.message || ''
  state.confirmText = opts.confirmText || 'Ya'
  state.danger = !!opts.danger
  state.show = true
  return new Promise((res) => { resolver = res })
}
function ok() { state.show = false; resolver?.(true) }
function cancel() { state.show = false; resolver?.(false) }

defineExpose({ open })
</script>

<style scoped>
.confirm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
.confirm { width: 100%; max-width: 360px; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; }
.title { font-weight: 700; font-size: 16px; margin-bottom: 8px; color: var(--fg); }
.msg { font-size: 14px; color: var(--muted); margin-bottom: 18px; line-height: 1.45; }
.actions { display: flex; justify-content: flex-end; gap: 10px; }
.btn { padding: 9px 18px; border: none; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; font-size: 14px; }
.btn.ghost { background: var(--surface-2); color: var(--fg); }
.btn.danger { background: var(--danger); color: #fff; }
</style>
