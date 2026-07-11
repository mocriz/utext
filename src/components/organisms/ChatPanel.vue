<template>
  <section class="chat-panel">
    <ChatHeader :partner="partner" :online="online" :typing="typing" @back="$emit('back')" />
    <MessageList
      :messages="messages"
      :me-id="meId"
      :typing="typing"
      @bubble-menu="(m, e) => $emit('bubble-menu', m, e)"
      @jump="(id) => $emit('jump', id)"
    />
    <Composer
      ref="composer"
      :draft="draft"
      :preview="preview"
      :reply-to="replyTo"
      :editing="editing"
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
})
defineEmits(['back', 'bubble-menu', 'jump', 'update:draft', 'typing', 'send', 'pick', 'confirm-photo', 'cancel-photo', 'cancel-reply', 'cancel-edit'])
defineExpose({ focus: () => composer.value?.focus() })
const composer = ref(null)
</script>

<style scoped>
.chat-panel { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
</style>
