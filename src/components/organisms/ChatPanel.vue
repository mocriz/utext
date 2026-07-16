<template>
  <section class="chat-panel">
    <ChatHeader :partner="partner" :online="online" :typing="typing" @back="$emit('back')" />
    <MessageList
      ref="list"
      :messages="messages"
      :me-id="meId"
      :typing="typing"
      @bubble-menu="(m, e) => $emit('bubble-menu', m, e)"
      @jump="(id) => $emit('jump', id)"
      @open-media="(src) => $emit('open-media', src)"
      @at-bottom-change="(b) => $emit('at-bottom-change', b)"
    />
    <Composer
      ref="composer"
      :draft="draft"
      :preview="preview"
      :reply-to="replyTo"
      :editing="editing"
      :show-jump="showJump"
      :new-count="newCount"
      @update:draft="$emit('update:draft', $event)"
      @typing="$emit('typing')"
      @send="$emit('send')"
      @pick="$emit('pick', $event)"
      @confirm-photo="$emit('confirm-photo')"
      @cancel-photo="$emit('cancel-photo')"
      @cancel-reply="$emit('cancel-reply')"
      @cancel-edit="$emit('cancel-edit')"
    />
  </section>
</template>

<script setup>
import { ref } from 'vue'
import ChatHeader from './ChatHeader.vue'
import MessageList from './MessageList.vue'
import Composer from './Composer.vue'

defineProps({
  partner: { type: Object, default: null },
  messages: { type: Array, default: () => [] },
  meId: { type: String, default: '' },
  typing: { type: Boolean, default: false },
  online: { type: Boolean, default: false },
  draft: { type: String, default: '' },
  preview: { type: Object, default: null },
  replyTo: { type: Object, default: null },
  editing: { type: Object, default: null },
  showJump: { type: Boolean, default: false },
  newCount: { type: Number, default: 0 },
})
defineEmits(['back', 'bubble-menu', 'jump', 'open-media', 'update:draft', 'typing', 'send', 'pick', 'confirm-photo', 'cancel-photo', 'cancel-reply', 'cancel-edit', 'jump-bottom', 'at-bottom-change'])
defineExpose({ focus: () => composer.value?.focus(), scrollToBottom: (smooth = false) => list.value?.scrollToBottom(smooth) })
const composer = ref(null)
const list = ref(null)
</script>

<style scoped>
.chat-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg); }
:deep(.msgs) { min-height: 0; }
</style>
