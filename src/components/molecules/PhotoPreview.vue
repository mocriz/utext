<template>
  <div class="preview">
    <img :src="url" class="thumb" alt="preview" />
    <div class="meta">
      <div class="fname">{{ name }}</div>
      <div class="actions">
        <BaseButton variant="primary" size="sm" @click="$emit('send')">Kirim</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="$emit('cancel')">Batal</BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import BaseButton from '../atoms/BaseButton.vue'
defineProps({ url: { type: String, required: true }, name: { type: String, default: '' } })
defineEmits(['send', 'cancel'])
</script>

<style scoped>
.preview {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; border-top: 1px solid var(--border); background: var(--surface-2);
}
.thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; }
.meta { flex: 1; display: flex; justify-content: space-between; align-items: center; }
.fname { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { display: flex; gap: 8px; }
</style>
