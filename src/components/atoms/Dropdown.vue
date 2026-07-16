<template>
  <div class="dd" ref="root">
    <button class="dd-trigger" :class="{ open }" type="button" @click="open = !open">
      <span class="dd-value">{{ currentLabel }}</span>
      <Icon name="mdi:chevron-down" :size="18" class="dd-caret" />
    </button>
    <Transition name="dd">
      <div v-if="open" class="dd-pop" @click.stop>
        <button
          v-for="opt in options"
          :key="opt.value"
          class="dd-opt"
          :class="{ active: opt.value === modelValue }"
          type="button"
          @click="pick(opt.value)"
        >
          <span>{{ opt.label }}</span>
          <Icon v-if="opt.value === modelValue" name="mdi:check" :size="16" class="dd-check" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ label, value }]
  placeholder: { type: String, default: 'Pilih…' },
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)

const currentLabel = computed(() => {
  const f = props.options.find((o) => o.value === props.modelValue)
  return f ? f.label : props.placeholder
})

function pick(v) {
  emit('update:modelValue', v)
  open.value = false
}

function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.dd { position: relative; display: inline-block; min-width: 180px; }
.dd-trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; padding: 9px 12px; cursor: pointer;
  background: var(--surface-2); color: var(--fg);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 14px; text-transform: capitalize;
  transition: border-color 140ms var(--ease-out), background 140ms var(--ease-out);
}
.dd-trigger:hover { border-color: var(--accent); }
.dd-trigger.open { border-color: var(--accent); }
.dd-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dd-caret { flex: none; transition: transform 160ms var(--ease-out); }
.dd-trigger.open .dd-caret { transform: rotate(180deg); }

/* popup di ATAS trigger, scroll vertikal */
.dd-pop {
  position: absolute; bottom: calc(100% + 6px); left: 0; right: 0;
  max-height: 220px; overflow-y: auto; z-index: 50;
  padding: 6px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.dd-opt {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; padding: 10px 12px; border: none; background: transparent;
  color: var(--fg); font-size: 14px; text-align: left; text-transform: capitalize; cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 140ms var(--ease-out);
}
.dd-opt:hover { background: var(--surface-2); }
.dd-opt.active { color: var(--accent); font-weight: 600; }
.dd-check { flex: none; color: var(--accent); }

/* enter/exit popup: fade + slide ke atas dikit */
.dd-enter-active, .dd-leave-active { transition: opacity 140ms var(--ease-out), transform 140ms var(--ease-out); }
.dd-enter-from, .dd-leave-to { opacity: 0; transform: translateY(6px); }
</style>
