<template>
  <div class="toast-wrap">
    <transition-group name="toast">
      <div v-for="t in toast.items" :key="t.id" class="toast" :class="t.type" @click="toast.dismiss(t.id)">
        {{ t.message }}
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { useToastStore } from '../../stores/toast'
const toast = useToastStore()
</script>

<style scoped>
.toast-wrap {
  position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; gap: 8px; z-index: 9999; pointer-events: none;
}
.toast {
  pointer-events: auto; cursor: pointer;
  min-width: 220px; max-width: 90vw; padding: 10px 14px; border-radius: var(--radius-sm);
  font-size: 13px; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.25);
}
.toast.success { background: #16a34a; }
.toast.error { background: #dc2626; }
.toast.info { background: #2563eb; }
.toast-enter-active, .toast-leave-active { transition: all .25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }
</style>
