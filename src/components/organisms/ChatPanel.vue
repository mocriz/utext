<template>
  <section class="chat-panel">
    <ChatHeader :partner="partner" :online="online" @back="$emit('back')" />
    <MessageList
      :messages="messages"
      :me-id="meId"
      :typing="typing"
      @bubble-menu="(m, e) => $emit('bubble-menu', m, e)"
    />
    <Composer
      :draft="draft"
      :preview="preview"
      @update:draft="$emit('update:draft', $event)"
      @typing="$emit('typing')"
      @send="$emit('send')"
      @pick="$emit('pick', $event)"
      @confirm-photo="$emit('confirm-photo')"
      @cancel-photo="$emit('cancel-photo')"
    />
  </section>
</template>

<script setup>
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
})
defineEmits(['back', 'bubble-menu', 'update:draft', 'typing', 'send', 'pick', 'confirm-photo', 'cancel-photo'])
</script>

<style scoped>
.chat-panel { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
</style>
