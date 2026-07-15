<template>
  <teleport to="body">
    <div v-if="show" class="ctx-backdrop" @click="close">
      <div class="ctx" :style="pos" @click.stop>
        <button v-for="item in items" :key="item.label"
          class="ci" :class="{ danger: item.danger }"
          @click="act(item)">
          <Icon v-if="item.icon" :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import Icon from '../atoms/Icon.vue'

const props = defineProps({
  // items: [{ label, value, danger?, icon? }]
  items: { type: Array, default: () => [] },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'close'])
const pos = ref({})
watch(() => props.show, (v) => {
  if (v) {
    const w = 220, h = props.items.length * 44 + 12
    const x = Math.min(props.x, window.innerWidth - w - 8)
    const y = Math.min(props.y, window.innerHeight - h - 8)
    pos.value = { left: x + 'px', top: y + 'px', width: w + 'px' }
  }
})
function act(item) { emit('select', item.value); close() }
function close() { emit('close') }
</script>

<style scoped>
.ctx-backdrop { position: fixed; inset: 0; z-index: 100; }
.ctx {
  position: fixed; padding: 6px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow);
}
.ci {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none; background: transparent;
  color: var(--fg); font-size: 14px; text-align: left; cursor: pointer; border-radius: var(--radius-sm);
}
.ci svg { width: 18px; height: 18px; flex: none; }
.ci:hover { background: var(--surface-2); }
.ci.danger { color: var(--danger); }
</style>
