<template>
  <button class="toggle" :class="{ on }" :aria-pressed="on" @click="$emit('click')">
    <span class="knob" />
  </button>
</template>

<script setup>
defineProps({ on: { type: Boolean, default: false } })
defineEmits(['click'])
</script>

<style scoped>
.toggle {
  width: 42px; height: 24px; border-radius: 12px; border: none;
  background: var(--border); position: relative; cursor: pointer; transition: background .15s;
  flex: none;
}
.toggle.on { background: var(--accent); }
.knob {
  position: absolute; top: 2px; left: 2px; width: 20px; height: 20px;
  border-radius: 50%; background: #fff; transition: left .15s;
}
.toggle.on .knob { left: 20px; }
</style>
