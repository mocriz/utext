<template>
  <textarea
    ref="el"
    class="ta"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    :aria-label="ariaLabel || placeholder"
    :maxlength="maxlength || undefined"
    @input="onInput"
    @keydown="onKey"
    @paste="onPaste"
  ></textarea>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: Boolean,
  rows: { type: Number, default: 1 },
  maxlength: { type: Number, default: 0 },
  ariaLabel: { type: String, default: '' },
  // emit Enter (tanpa shift) sebagai "send" — caller cek e.isComposing
  sendOnEnter: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue', 'input', 'enter', 'paste-image', 'keydown'])

const el = ref(null)

function onInput(e) {
  emit('update:modelValue', e.target.value)
  emit('input', e)
  autoResize()
}
function onKey(e) {
  emit('keydown', e)
  // Enter = kirim (kecuali shift / sedang IME composition)
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    if (props.sendOnEnter) { e.preventDefault(); emit('enter', e) }
  }
}
function onPaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      const f = it.getAsFile()
      if (f) { e.preventDefault(); emit('paste-image', f); return }
    }
  }
}
function autoResize() {
  const t = el.value
  if (!t) return
  t.style.height = 'auto'
  const max = props.maxHeight || 140
  const h = Math.min(t.scrollHeight, max)
  t.style.height = h + 'px'
  // scrollbar hanya muncul kalau konten beneran overflow (scrollHeight > max)
  t.classList.toggle('scroll', t.scrollHeight > max + 1)
}
watch(() => props.modelValue, () => nextTick(autoResize))
onMounted(() => nextTick(autoResize))
defineExpose({ focus: () => el.value?.focus(), blur: () => el.value?.blur() })
</script>

<style scoped>
.ta {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--fg);
  font-size: 14px;
  line-height: 1.4;
  font-family: inherit;
  outline: none;
  resize: none;
  overflow-y: auto;
  transition: border-color .15s;
}
.ta:focus { border-color: var(--accent); }
.ta:disabled { opacity: .6; cursor: not-allowed; }
/* scrollbar ramping, hanya muncul kalau overflow (class .scroll di-set pas autoResize) */
.ta { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.ta.scroll { overflow-y: auto; }
.ta:not(.scroll) { overflow-y: hidden; }
.ta::-webkit-scrollbar { width: 8px; }
.ta::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }
.ta::-webkit-scrollbar-track { background: transparent; }
</style>
