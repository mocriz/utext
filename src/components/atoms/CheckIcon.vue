<template>
  <span class="receipt" :class="state" :title="title">
    <svg v-if="state === 'pending'" viewBox="0 0 16 16" class="ic">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5 V8 L10.5 9.5" />
    </svg>
    <svg v-else viewBox="0 0 18 12" class="ic">
      <path d="M1 6.5 L5 10.5 L12 2" />
      <path v-if="state !== 'sent'" d="M7 6.5 L11 10.5 L18 2" />
    </svg>
  </span>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  // sent = 1 centang abu, delivered = 2 centang abu, read = 2 centang biru, pending = jam (offline)
  state: { type: String, default: 'sent' },
})
const title = computed(() =>
  props.state === 'read' ? 'Dibaca'
  : props.state === 'delivered' ? 'Terkirim'
  : props.state === 'pending' ? 'Menunggu koneksi…'
  : 'Terkirim')
</script>

<style scoped>
.receipt { display: inline-flex; vertical-align: middle; }
.ic { width: 16px; height: 11px; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.sent .ic, .delivered .ic { stroke: var(--muted); }
.read .ic { stroke: var(--read); }
.pending .ic { stroke: var(--muted); opacity: .7; }
</style>
