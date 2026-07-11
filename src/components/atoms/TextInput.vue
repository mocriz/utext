<template>
  <input
    ref="el"
    class="ti"
    :value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="$emit('update:modelValue', $event.target.value); $emit('input', $event)"
    @keyup.enter="$emit('enter', $event)"
  />
</template>

<script setup>
import { ref } from 'vue'
const el = ref(null)
defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  disabled: Boolean,
})
defineEmits(['update:modelValue', 'input', 'enter'])
defineExpose({ focus: () => el.value?.focus() })
</script>

<style scoped>
.ti {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  font-size: 14px;
  outline: none;
  transition: border-color .15s;
}
.ti:focus { border-color: var(--accent); }
.ti:disabled { opacity: .6; cursor: not-allowed; }
</style>
