<template>
  <div class="search">
    <TextInput
      :model-value="modelValue"
      :placeholder="placeholder"
      @update:model-value="$emit('update:modelValue', $event)"
      @input="$emit('search', $event)"
      @enter="$emit('search', $event)"
    >
      <template #prefix>🔍</template>
    </TextInput>
    <ul v-if="results.length" class="results">
      <li v-for="u in results" :key="u.id" @click="$emit('pick', u)">
        <Avatar :src="u.avatar_url" :name="u.username || u.display_name" size="sm" />
        <span>@{{ u.username || u.display_name }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import TextInput from '../atoms/TextInput.vue'
import Avatar from '../atoms/Avatar.vue'

defineProps({
  modelValue: { type: String, default: '' },
  results: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Cari username…' },
})
defineEmits(['update:modelValue', 'search', 'pick'])
</script>

<style scoped>
.search { position: relative; }
.results {
  position: absolute;
  z-index: 20;
  top: 100%;
  left: 0; right: 0;
  margin: 4px 0 0;
  padding: 4px;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  max-height: 240px;
  overflow-y: auto;
}
.results li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.results li:hover { background: var(--surface-2); }
</style>
