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
      <span class="rq-text">{{ replyTo.text || 'Foto' }}</span>
    </div>

    <div class="bubble" :class="mine ? 'me' : 'them'">
      <img v-if="photo" :src="photo" class="photo" @click="$emit('open-media', photo)" />
      <span v-else class="content">
        <template v-for="(n, i) in nodes" :key="i">
          <span v-if="n.type === 'text'">{{ n.text }}</span>
          <strong v-else-if="n.type === 'bold'">{{ n.text }}</strong>
          <em v-else-if="n.type === 'italic'">{{ n.text }}</em>
          <code v-else-if="n.type === 'code'" class="md-code">{{ n.text }}</code>
          <span v-else-if="n.type === 'strike'" class="md-strike">{{ n.text }}</span>
          <a v-else-if="n.type === 'link'" :href="n.href" target="_blank" rel="noopener noreferrer" @click.stop>{{ n.text }}</a>
        </template>
      </span>
      <span class="meta">
        <span class="time" :title="fullTime">{{ time }}</span>
        <span v-if="edited" class="edited">diedit</span>
        <CheckIcon v-if="mine" :state="receipt" />
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import CheckIcon from '../atoms/CheckIcon.vue'
import { parseMarkdown } from '../../lib/markdown'

const props = defineProps({
  id: { type: [String, Number], default: '' },
  text: { type: String, default: '' },
  photo: { type: String, default: '' },
  mine: { type: Boolean, default: false },
  time: { type: String, default: '' },
  fullTime: { type: String, default: '' },
  receipt: { type: String, default: 'sent' },
  edited: { type: Boolean, default: false },
  replyTo: { type: Object, default: null },
})
const emit = defineEmits(['menu', 'jump', 'open-media'])
const nodes = computed(() => parseMarkdown(props.text))

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
.content { white-space: pre-wrap; }
.photo { max-width: 220px; border-radius: 8px; display: block; cursor: pointer; }
.md-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
  background: rgba(127,127,127,.22); padding: 1px 5px; border-radius: 4px;
}
.md-strike { text-decoration: line-through; opacity: .75; }
.bubble a { color: inherit; text-decoration: underline; }
.meta { display: inline-flex; align-items: center; gap: 4px; float: right; margin: 2px 0 -2px 8px; }
.time { font-size: 11px; color: var(--muted); cursor: default; }
.edited { font-size: 10px; color: var(--muted); font-style: italic; }
</style>
