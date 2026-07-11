<template>
  <div
    class="bubble-wrap"
    :class="mine ? 'me' : 'them'"
    @contextmenu.prevent="$emit('menu', $event)"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <div class="bubble" :class="mine ? 'me' : 'them'">
      <img v-if="photo" :src="photo" class="photo" />
      <span v-else>{{ text }}</span>
      <span class="meta">
        <span class="time">{{ time }}</span>
        <CheckIcon v-if="mine" :state="receipt" />
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CheckIcon from '../atoms/CheckIcon.vue'

const props = defineProps({
  text: { type: String, default: '' },
  photo: { type: String, default: '' },
  mine: { type: Boolean, default: false },
  time: { type: String, default: '' },
  receipt: { type: String, default: 'sent' }, // sent | delivered | read
})
const emit = defineEmits(['menu'])

// tap lama (mobile) -> buka context menu
let timer = null
function onTouchStart() {
  timer = setTimeout(() => { emit('menu', { clientX: null, clientY: null, touch: true }) }, 550)
}
function onTouchEnd() { clearTimeout(timer) }
</script>

<style scoped>
.bubble-wrap { display: flex; margin: 2px 0; }
.bubble-wrap.me { justify-content: flex-end; }
.bubble-wrap.them { justify-content: flex-start; }
.bubble {
  max-width: 74%;
  padding: 7px 10px 4px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.35;
  position: relative;
  word-break: break-word;
}
.bubble.me { background: var(--bubble-me); color: var(--bubble-me-fg); border-bottom-right-radius: 3px; }
.bubble.them { background: var(--bubble-them); color: var(--bubble-them-fg); border-bottom-left-radius: 3px; }
.photo { max-width: 220px; border-radius: 8px; display: block; }
.meta { display: inline-flex; align-items: center; gap: 4px; float: right; margin: 2px 0 -2px 8px; }
.time { font-size: 11px; color: var(--muted); }
</style>
