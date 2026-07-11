<template>
  <span class="dot" :class="on ? 'on' : 'off'" :title="on ? 'online' : 'offline'" />
</template>

<script setup>
defineProps({
  on: { type: Boolean, default: false },
})
</script>

<style scoped>
.dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  box-sizing: content-box;
}
.on { background: #2ecc71; }
.off { background: #bbb; }
</style>
