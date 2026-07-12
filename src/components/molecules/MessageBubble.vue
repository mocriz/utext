<template>
  <div
    class="bubble-wrap"
    :id="'msg-' + id"
    :class="mine ? 'me' : 'them'"
    @contextmenu.prevent="$emit('menu', $event)"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <!-- reply preview (quote) -->
    <div v-if="replyTo" class="reply-quote" @click="$emit('jump', replyTo)">
      <span class="rq-name">{{ replyTo.mine ? 'Anda' : replyTo.name }}</span>
      <span class="rq-text">{{ replyTo.text || '📷 foto' }}</span>
    </div>

    <div class="bubble" :class="mine ? 'me' : 'them'">
      <img v-if="photo" :src="photo" class="photo" @click="$emit('open-media', photo)" />
      <span v-else>{{ text }}</span>
      <span class="meta">
        <span class="time" :title="fullTime">{{ time }}</span>
        <span v-if="edited" class="edited">·edit</span>
        <CheckIcon v-if="mine" :state="receipt" />
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CheckIcon from '../atoms/CheckIcon.vue'

const props = defineProps({
  id: { type: [String, Number], default: '' },
  text: { type: String, default: '' },
  photo: { type: String, default: '' },
  mine: { type: Boolean, default: false },
  time: { type: String, default: '' },
  fullTime: { type: String, default: '' },
  receipt: { type: String, default: 'sent' },
  edited: { type: Boolean, default: false },
  replyTo: { type: Object, default: null }, // { id, mine, name, text }
})
const emit = defineEmits(['menu', 'jump', 'open-media'])

let timer = null
function onTouchStart() {
  timer = setTimeout(() => { emit('menu', { clientX: null, clientY: null, touch: true }) }, 550)
}
function onTouchEnd() { clearTimeout(timer) }
</script>

<style scoped>
.bubble-wrap { display: flex; margin: 2px 0; flex-direction: column; align-items: stretch; }
.bubble-wrap.me { align-items: flex-end; }
.bubble-wrap.them { align-items: flex-start; }
.reply-quote {
  max-width: 74%; margin-bottom: 2px; padding: 4px 10px; cursor: pointer;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-left: 3px solid var(--accent); border-radius: 6px; font-size: 12px;
}
.rq-name { font-weight: 700; color: var(--accent); margin-right: 6px; }
.rq-text { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; display: inline-block; vertical-align: bottom; }
.bubble {
  max-width: 74%; padding: 7px 10px 4px; border-radius: 12px;
  font-size: 14px; line-height: 1.35; position: relative; word-break: break-word;
}
.bubble.me { background: var(--bubble-me); color: var(--bubble-me-fg); border-bottom-right-radius: 3px; }
.bubble.them { background: var(--bubble-them); color: var(--bubble-them-fg); border-bottom-left-radius: 3px; }
.photo { max-width: 220px; border-radius: 8px; display: block; cursor: pointer; }
.meta { display: inline-flex; align-items: center; gap: 4px; float: right; margin: 2px 0 -2px 8px; }
.time { font-size: 11px; color: var(--muted); cursor: default; }
.edited { font-size: 10px; color: var(--muted); font-style: italic; }
</style>
