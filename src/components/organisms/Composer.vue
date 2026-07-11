<template>
  <div class="composer">
    <!-- reply preview bar -->
    <div v-if="replyTo" class="reply-bar">
      <div class="rb-text">
        <span class="rb-name">{{ replyTo.mine ? 'Balas ke diri sendiri' : 'Balas: ' + replyTo.name }}</span>
        <span class="rb-preview">{{ replyTo.text || '📷 foto' }}</span>
      </div>
      <IconButton icon="✕" title="Batal balas" @click="$emit('cancel-reply')" />
    </div>

    <!-- edit bar -->
    <div v-if="editing" class="edit-bar">
      <span class="eb-label">Edit pesan</span>
      <IconButton icon="✕" title="Batal edit" @click="$emit('cancel-edit')" />
    </div>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="$emit('pick', $event)" />
    <IconButton icon="📷" title="Kirim foto" @click="fileInput?.click()" />
    <TextInput
      ref="ti"
      :model-value="draft"
      :placeholder="editing ? 'Edit pesan…' : 'Tulis pesan…'"
      @update:model-value="$emit('update:draft', $event)"
      @input="$emit('typing')"
      @enter="$emit('send')"
    />
    <BaseButton variant="primary" :disabled="!canSend" @click="$emit('send')">{{ editing ? 'Simpan' : 'Kirim' }}</BaseButton>

    <PhotoPreview
      v-if="preview"
      :url="preview.url"
      :name="preview.name"
      @send="$emit('confirm-photo')"
      @cancel="$emit('cancel-photo')"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import IconButton from '../atoms/IconButton.vue'
import TextInput from '../atoms/TextInput.vue'
import BaseButton from '../atoms/BaseButton.vue'
import PhotoPreview from '../molecules/PhotoPreview.vue'

const props = defineProps({
  draft: { type: String, default: '' },
  preview: { type: Object, default: null },
  replyTo: { type: Object, default: null },
  editing: { type: Object, default: null },
})
const ti = ref(null)
const emit = defineEmits([
  'update:draft', 'typing', 'send', 'pick', 'confirm-photo', 'cancel-photo',
  'cancel-reply', 'cancel-edit',
])
const fileInput = ref(null)
const canSend = computed(() => props.draft.trim().length > 0 || !!props.preview)
defineExpose({ focus: () => ti.value?.focus() })
</script>

<style scoped>
.composer { position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--border); background: var(--surface); }
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
</style>
