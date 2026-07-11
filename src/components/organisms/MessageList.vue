<template>
  <div ref="scroller" class="msgs">
    <template v-for="m in messages" :key="m.id">
      <MessageBubble
        :text="m.plaintext"
        :photo="m.photoUrl"
        :mine="m.senderId === meId"
        :time="m.time"
        :receipt="m.receipt"
        @menu="(e) => $emit('bubble-menu', m, e)"
      />
    </template>
    <TypingIndicator v-if="typing" />
    <div v-if="!messages.length && !typing" class="hint">Belum ada pesan — kirim untuk mulai.</div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import MessageBubble from '../molecules/MessageBubble.vue'
import TypingIndicator from '../molecules/TypingIndicator.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  meId: { type: String, default: '' },
  typing: { type: Boolean, default: false },
})
const emit = defineEmits(['bubble-menu'])
const scroller = ref(null)

watch(() => props.messages.length, async () => {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
})
</script>

<style scoped>
.msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.hint { color: var(--muted); font-size: 13px; text-align: center; margin: auto; }
</style>
