<template>
  <button
    class="btn"
    :class="[variant, size, { block }]"
    :type="type"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'primary' }, // primary | ghost | danger | subtle
  size: { type: String, default: 'md' }, // sm | md | lg
  type: { type: String, default: 'button' },
  disabled: Boolean,
  block: Boolean,
})
defineEmits(['click'])
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
  line-height: 1;
  transition: background 140ms var(--ease-out), opacity 140ms var(--ease-out), transform 140ms var(--ease-out);
  white-space: nowrap;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn:active:not(:disabled) { transform: scale(0.97); }
.md { padding: 8px 14px; font-size: 14px; }
.sm { padding: 5px 10px; font-size: 13px; }
.lg { padding: 11px 18px; font-size: 15px; }
.block { width: 100%; }

/* icon-only button (cuma ada <svg>, gak ada teks) -> padding square biar centered */
.btn:has(> svg:only-child) { padding: 8px; }
.btn.sm:has(> svg:only-child) { padding: 8px; }

.primary { background: var(--accent); color: var(--accent-fg); }
.primary:hover:not(:disabled) { filter: brightness(1.07); }

.ghost { background: transparent; color: var(--fg); }
.ghost:hover:not(:disabled) { background: var(--surface-2); }

.subtle { background: var(--surface-2); color: var(--muted); }
.subtle:hover:not(:disabled) { background: var(--border); }

.danger { background: transparent; color: var(--danger); }
.danger:hover:not(:disabled) { background: color-mix(in srgb, var(--danger) 12%, transparent); }
</style>
