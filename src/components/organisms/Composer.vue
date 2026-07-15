<template>
  <div class="composer">
    <!-- reply preview bar -->
    <div v-if="replyTo" class="reply-bar">
      <div class="rb-text">
        <span class="rb-name">{{ replyTo.mine ? 'Balas ke diri sendiri' : 'Balas: ' + replyTo.name }}</span>
        <span class="rb-preview">{{ replyTo.text || 'Foto' }}</span>
      </div>
      <IconButton name="mdi:close" title="Batal balas" @click="$emit('cancel-reply')" />
    </div>

    <!-- edit bar -->
    <div v-if="editing" class="edit-bar">
      <span class="eb-label">Edit pesan</span>
      <IconButton name="mdi:close" title="Batal edit" @click="$emit('cancel-edit')" />
    </div>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="$emit('pick', $event)" />
    <IconButton name="mdi:image-outline" title="Kirim foto" @click="fileInput?.click()" />

    <div class="field">
      <TextArea
        ref="ta"
        :model-value="draft"
        :placeholder="editing ? 'Edit pesan…' : 'Tulis pesan…'"
        :maxlength="MAX"
        :rows="1"
        aria-label="Pesan"
        @update:model-value="onDraft"
        @enter="onSend"
        @keydown="$emit('typing')"
        @paste-image="onPasteImage"
      />
      <div v-if="overLimit" class="counter err">Batas {{ MAX }} karakter</div>
    </div>

    <BaseButton variant="primary" :disabled="!canSend" class="send-btn" title="Kirim" @click="onSend">
      <Icon name="mdi:send" :size="20" />
    </BaseButton>

    <!-- tombol loncat ke bawah (muncul kalau ada pesan baru & user di atas) -->
    <button
      v-if="showJump"
      class="jump-btn"
      title="Lihat pesan baru"
      @click="$emit('jump-bottom')"
    >
      <Icon name="mdi:chevron-down" :size="20" />
      <span v-if="newCount > 0" class="badge">{{ newCount > 99 ? '99+' : newCount }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import IconButton from '../atoms/IconButton.vue'
import Icon from '../atoms/Icon.vue'
import TextArea from '../atoms/TextArea.vue'
import BaseButton from '../atoms/BaseButton.vue'
import PhotoPreview from '../molecules/PhotoPreview.vue'

const props = defineProps({
  draft: { type: String, default: '' },
  preview: { type: Object, default: null },
  replyTo: { type: Object, default: null },
  editing: { type: Object, default: null },
  showJump: { type: Boolean, default: false },
  newCount: { type: Number, default: 0 },
})
const ta = ref(null)
const fileInput = ref(null)
const MAX = 4096

const emit = defineEmits([
  'update:draft', 'typing', 'send', 'pick', 'confirm-photo', 'cancel-photo',
  'cancel-reply', 'cancel-edit', 'paste-image', 'jump-bottom',
])

const len = computed(() => props.draft.length)
const overLimit = computed(() => len.value > MAX)
// kirim boleh kalau ada teks non-whitespace DAN ga over limit
const canSend = computed(() => props.draft.trim().length > 0 && !overLimit.value)

function onDraft(v) {
  // blokir input melebihi limit (karakter ke-4097 ke atas diabaikan)
  if (v.length > MAX) v = v.slice(0, MAX)
  emit('update:draft', v)
}
function onSend() {
  if (!canSend.value) return
  emit('send')
}
function onPasteImage(f) { emit('paste-image', f) }

defineExpose({ focus: () => ta.value?.focus() })
</script>

<style scoped>
.composer { position: relative; display: flex; align-items: flex-end; gap: 8px; padding: 8px 12px; padding-bottom: calc(max(8px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px)); border-top: 1px solid var(--border); background: var(--surface); }
.composer :deep(.preview) { position: absolute; left: 0; right: 0; bottom: 100%; }
.reply-bar, .edit-bar {
  position: absolute; left: 0; right: 0; bottom: 100%;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 6px 12px; background: var(--surface-2); border-top: 1px solid var(--border);
}
.rb-text { overflow: hidden; }
.rb-name { font-size: 12px; font-weight: 700; color: var(--accent); }
.rb-preview { display: block; font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eb-label { font-size: 12px; font-weight: 700; color: var(--accent); }
.field { flex: 1; min-width: 0; }
.counter { font-size: 11px; text-align: right; margin-top: 2px; }
.counter.err { color: var(--danger); }
.send-btn { flex: none; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; }
.jump-btn {
  flex: none; position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--fg); cursor: pointer;
}
.jump-btn .badge {
  position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 9px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
</style>
