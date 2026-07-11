<template>
  <div class="user-item" @click="$emit('click', user)">
    <Avatar :src="user.avatar_url" :name="user.username || user.display_name" />
    <div class="meta">
      <div class="name">@{{ user.username || user.display_name }}</div>
      <div v-if="user.display_name && user.username" class="sub">{{ user.display_name }}</div>
    </div>
  </div>
</template>

<script setup>
import Avatar from '../atoms/Avatar.vue'
defineProps({ user: { type: Object, required: true } })
defineEmits(['click'])
</script>

<style scoped>
.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.user-item:hover { background: var(--surface-2); }
.name { font-weight: 600; font-size: 14px; }
.sub { font-size: 12px; color: var(--muted); }
</style>
