<template>
  <div class="composer">
    <input ref="fileInput" type="file" accept="image/*" hidden @change="$emit('pick', $event)" />
    <IconButton icon="📷" title="Kirim foto" @click="fileInput?.click()" />
    <TextInput
      :model-value="draft"
      placeholder="Tulis pesan…"
      @update:model-value="$emit('update:draft', $event)"
      @input="$emit('typing')"
      @enter="$emit('send')"
    />
    <BaseButton variant="primary" :disabled="!canSend" @click="$emit('send')">Kirim</BaseButton>
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
  preview: { type: Object, default: null }, // { url, name }
})
const emit = defineEmits(['update:draft', 'typing', 'send', 'pick', 'confirm-photo', 'cancel-photo'])
const fileInput = ref(null)
const canSend = computed(() => props.draft.trim().length > 0 || !!props.preview)
</script>

<style scoped>
.composer { position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--border); background: var(--surface); }
.composer :deep(.preview) { position: absolute; left: 0; right: 0; bottom: 100%; }
</style>
