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
    <!-- tombol loncat ke bawah: di LUAR composer, sejajar vertikal dgn tombol Kirim -->
    <Transition name="jump">
      <button
        v-if="showJump"
        class="jump-btn"
        title="Ke pesan terbaru"
        @mousedown.prevent
        @click="$emit('jump-bottom')"
      >
        <Icon name="mdi:chevron-down" :size="20" />
        <span v-if="newCount > 0" class="badge">{{ newCount > 99 ? '99+' : newCount }}</span>
      </button>
    </Transition>
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
import Icon from '../atoms/Icon.vue'

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
.chat-panel { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg); }
:deep(.msgs) { min-height: 0; }
/* tombol loncat ke bawah: absolute kanan-bawah, sejajar tombol Kirim (vertikal center composer) */
.jump-btn {
  position: absolute; right: 16px;
  bottom: calc(18px + env(safe-area-inset-bottom) + var(--kb-inset, 0px));
  z-index: 15;
  display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; border-radius: 50%;
  border: 1px solid var(--border); background: var(--surface); color: var(--fg);
  box-shadow: 0 2px 10px rgba(0,0,0,.18); cursor: pointer;
  transition: transform 140ms var(--ease-out), background 140ms var(--ease-out);
}
.jump-btn:hover { background: var(--surface-2); }
.jump-btn:active { transform: scale(0.94); }
.jump-btn .badge {
  position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 9px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
/* enter/exit: scale + fade (dari bawah, origin-aware dari posisinya) */
.jump-enter-active, .jump-leave-active { transition: opacity 160ms var(--ease-out), transform 160ms var(--ease-out); }
.jump-enter-from, .jump-leave-to { opacity: 0; transform: scale(0.8) translateY(8px); }
</style>
