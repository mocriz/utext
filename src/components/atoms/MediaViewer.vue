<template>
  <teleport to="body">
    <div v-if="src" class="mv-backdrop" @click="close">
      <button class="mv-close" @click.stop="close" title="Tutup (Esc)"><Icon name="mdi:close" :size="22" /></button>
      <div
        class="mv-stage"
        @click.stop
        @wheel.prevent="onWheel"
        @touchstart.passive="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @dblclick="reset"
      >
        <img
          class="mv-img"
          :src="src"
          :style="{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }"
          draggable="false"
          @mousedown.prevent="onDragStart"
        />
      </div>
      <div class="mv-hint">Scroll / pinch: zoom · drag: geser · Esc: tutup</div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({ src: { type: String, default: '' } })
const emit = defineEmits(['close'])

const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
let dragging = false
let sx = 0, sy = 0, stx = 0, sty = 0

function clampScale(s) { return Math.min(Math.max(s, 0.5), 8) }
function onWheel(e) {
  const delta = -e.deltaY * 0.0015
  scale.value = clampScale(scale.value + delta)
  if (scale.value <= 1) { tx.value = 0; ty.value = 0 }
}
function onDragStart(e) {
  if (scale.value <= 1) return
  dragging = true; sx = e.clientX; sy = e.clientY; stx = tx.value; sty = ty.value
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}
function onDragMove(e) {
  if (!dragging) return
  tx.value = stx + (e.clientX - sx)
  ty.value = sty + (e.clientY - sy)
}
function onDragEnd() { dragging = false; window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd) }

// pinch zoom (touch)
let pinchStart = 0, pinchScale = 1, startDist = 0
function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) }
function onTouchStart(e) {
  if (e.touches.length === 2) {
    startDist = dist(e.touches)
    pinchScale = scale.value
  } else if (e.touches.length === 1 && scale.value > 1) {
    dragging = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; stx = tx.value; sty = ty.value
  }
}
function onTouchMove(e) {
  if (e.touches.length === 2) {
    const d = dist(e.touches)
    if (startDist) { scale.value = clampScale((d / startDist) * pinchScale); if (scale.value <= 1) { tx.value = 0; ty.value = 0 } }
  } else if (dragging && e.touches.length === 1) {
    tx.value = stx + (e.touches[0].clientX - sx)
    ty.value = sty + (e.touches[0].clientY - sy)
  }
}
function reset() { scale.value = 1; tx.value = 0; ty.value = 0 }
function close() { reset(); emit('close') }
function onKey(e) { if (e.key === 'Escape') close() }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); onDragEnd() })
</script>

<style scoped>
.mv-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.92); z-index: 500; display: flex; align-items: center; justify-content: center; }
.mv-stage { max-width: 96vw; max-height: 96vh; overflow: hidden; display: flex; align-items: center; justify-content: center; touch-action: none; }
.mv-img { max-width: 96vw; max-height: 96vh; object-fit: contain; user-select: none; transition: transform .05s linear; cursor: grab; }
.mv-img:active { cursor: grabbing; }
.mv-close { position: fixed; top: 16px; right: 18px; width: 40px; height: 40px; border-radius: 50%; border: none; background: rgba(255,255,255,.15); color: #fff; font-size: 18px; cursor: pointer; z-index: 501; }
.mv-close:hover { background: rgba(255,255,255,.3); }
.mv-hint { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,.7); font-size: 12px; }
</style>
