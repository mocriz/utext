<template>
  <div ref="scroller" class="msgs" @scroll="onScroll">
    <template v-for="m in messages" :key="m.id">
      <MessageBubble
        :id="m.id"
        :text="m.plaintext"
        :photo="m.photoUrl"
        :mine="m.senderId === meId"
        :time="m.time"
        :full-time="m.fullTime"
        :receipt="m.receipt"
        :edited="m.edited"
        :reply-to="resolveReply(m)"
        :class="{ flash: flashId === m.id }"
        @menu="(e) => $emit('bubble-menu', m, e)"
        @jump="(id) => jumpTo(id)"
        @open-media="(src) => $emit('open-media', src)"
      />
    </template>
    <div v-if="!messages.length" class="hint">Belum ada pesan. Kirim untuk memulai percakapan.</div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import MessageBubble from '../molecules/MessageBubble.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  meId: { type: String, default: '' },
  typing: { type: Boolean, default: false },
})
const emit = defineEmits(['bubble-menu', 'jump', 'open-media', 'at-bottom-change'])
const scroller = ref(null)
const atBottom = ref(true)
const flashId = ref(null)

// bangun object replyTo utk render quote (cari pesan asli di list)
function resolveReply(m) {
  if (!m.reply_to) return null
  const orig = props.messages.find((x) => x.id === m.reply_to)
  if (!orig) return { id: m.reply_to, mine: m.senderId === props.meId, name: '', text: 'pesan telah dihapus' }
  return {
    id: orig.id,
    mine: orig.senderId === props.meId,
    name: orig.senderId === props.meId ? 'Anda' : (orig._partnerName || ''),
    text: orig.plaintext || 'Foto',
  }
}

// track posisi scroll (buat tombol jump-to-bottom)
function isAtBottom() {
  const el = scroller.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 60
}
function onScroll() {
  const b = isAtBottom()
  if (b !== atBottom.value) {
    atBottom.value = b
    emit('at-bottom-change', b)
  }
}

// pesan baru: scroll ke bawah HANYA kalau user sudah di bawah (ga ganggu yg lagi baca atas)
watch(() => props.messages.length, async () => {
  await nextTick()
  if (atBottom.value && scroller.value) {
    scroller.value.scrollTop = scroller.value.scrollHeight
  }
})

function scrollToBottom(smooth = false) {
  const el = scroller.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  atBottom.value = true
  emit('at-bottom-change', true)
}

// klik quote reply -> scroll ke bubble asli + flash
function jumpTo(id) {
  const el = scroller.value?.querySelector('#msg-' + CSS.escape(id))
  if (!el) { emit('jump', id); return }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashId.value = id
  setTimeout(() => { if (flashId.value === id) flashId.value = null }, 1500)
}

defineExpose({ scrollToBottom, scrollToId: jumpTo, isAtBottom: () => atBottom.value })
</script>

<style scoped>
.msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.hint { color: var(--muted); font-size: 13px; text-align: center; margin: auto; }
:deep(.flash) {
  animation: flash 0.9s var(--ease-out);
}
@keyframes flash {
  0%, 100% { box-shadow: inset 0 0 0 0 transparent; }
  30% { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent); }
}
</style>
