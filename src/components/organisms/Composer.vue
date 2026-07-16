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
    <button class="media-btn" title="Kirim foto" @click="fileInput?.click()">
      <Icon name="mdi:image-outline" :size="22" />
    </button>

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

    <button
      class="send-btn"
      :disabled="!canSend"
      title="Kirim"
      @click="onSend"
    >
      <Icon name="mdi:send" :size="20" />
    </button>

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
import Icon from '../atoms/Icon.vue'
import TextArea from '../atoms/TextArea.vue'

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
.composer {
  position: relative;
  display: flex; align-items: flex-end; gap: 6px;
  padding: 10px 12px;
  padding-bottom: calc(max(10px, env(safe-area-inset-bottom)) + var(--kb-inset, 0px));
  border-top: 1px solid var(--border); background: var(--surface);
}
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

/* textarea dibungkus bubble rounded */
.field {
  flex: 1; min-width: 0;
  display: flex; align-items: flex-end;
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 22px; padding: 4px 6px 4px 14px;
}
.field:focus-within { border-color: var(--accent); }
.counter { font-size: 11px; text-align: right; margin-top: 2px; }
.counter.err { color: var(--danger); }

/* tombol media: rounded, subtle */
.media-btn {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 50%;
  background: transparent; color: var(--muted); border: none; cursor: pointer;
  transition: background 140ms var(--ease-out), color 140ms var(--ease-out), transform 140ms var(--ease-out);
}
.media-btn:hover { background: var(--surface-2); color: var(--fg); }
.media-btn:active { transform: scale(0.94); }

/* tombol kirim: rounded-full accent, menyatu di kanan bubble */
.send-btn {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; border-radius: 50%;
  background: var(--accent); color: var(--accent-fg); border: none; cursor: pointer;
  transition: transform 140ms var(--ease-out), opacity 140ms var(--ease-out), background 140ms var(--ease-out);
}
.send-btn:active:not(:disabled) { transform: scale(0.94); }
.send-btn:disabled { opacity: .4; cursor: not-allowed; }

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
