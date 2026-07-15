<template>
  <Icon :icon="name" :width="size" :height="size" :class="cls" />
</template>

<script setup>
import { Icon } from '@iconify/vue'

defineProps({
  name: { type: String, required: true }, // misal 'mdi:close', 'lucide:search'
  size: { type: [Number, String], default: 20 },
  cls: { type: String, default: '' },
})
</script>
