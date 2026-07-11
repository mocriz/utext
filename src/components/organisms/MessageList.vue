<template>
  <div ref="scroller" class="msgs">
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
        @menu="(e) => $emit('bubble-menu', m, e)"
        @jump="(id) => $emit('jump', id)"
      />
    </template>
    <div v-if="!messages.length" class="hint">Belum ada pesan — kirim untuk mulai.</div>
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
const emit = defineEmits(['bubble-menu', 'jump'])
const scroller = ref(null)

// bangun object replyTo utk render quote
function resolveReply(m) {
  if (!m.reply_to) return null
  const orig = props.messages.find((x) => x.id === m.reply_to)
  if (!orig) return { id: m.reply_to, mine: m.senderId === props.meId, name: '', text: 'pesan telah dihapus' }
  return {
    id: orig.id,
    mine: orig.senderId === props.meId,
    name: orig.senderId === props.meId ? 'Anda' : (orig._partnerName || ''),
    text: orig.plaintext || '📷 foto',
  }
}

watch(() => props.messages.length, async () => {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
})
</script>

<style scoped>
.msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.hint { color: var(--muted); font-size: 13px; text-align: center; margin: auto; }
</style>
