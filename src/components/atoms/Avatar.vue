<template>
  <span class="avatar" :class="size" :style="bg">
    <img
      v-if="resolved && !failed"
      :src="resolved"
      :alt="alt"
      loading="lazy"
      decoding="async"
      @error="onErr"
    />
    <span v-else class="initials">{{ initials }}</span>
  </span>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
  color: { type: String, default: '' },
})

const alt = computed(() => props.name || 'avatar')
const initials = computed(() => (props.name || '?').trim().slice(0, 2).toUpperCase())
const bg = computed(() => props.color ? { background: props.color } : {})
const failed = ref(false)
const resolved = ref(props.src)

// cache avatar Google CDN -> dataURL (module + localStorage) biar ga fetch berkali-kali (hindari 429)
const memCache = new Map()
function lsGet(k) { try { return JSON.parse(localStorage.getItem('utext_avatar_cache') || '{}')[k] } catch { return null } }
function lsSet(k, v) { try { const c = JSON.parse(localStorage.getItem('utext_avatar_cache') || '{}'); c[k] = v; localStorage.setItem('utext_avatar_cache', JSON.stringify(c)) } catch {} }

async function resolve(src) {
  failed.value = false
  if (!src) { resolved.value = ''; return }
  if (!src.includes('googleusercontent.com')) { resolved.value = src; return }
  if (memCache.has(src)) { resolved.value = memCache.get(src); return }
  const cached = lsGet(src)
  if (cached) { memCache.set(src, cached); resolved.value = cached; return }
  try {
    const res = await fetch(src, { mode: 'cors' })
    const blob = await res.blob()
    const dataUrl = await new Promise((r) => {
      const fr = new FileReader()
      fr.onload = () => r(fr.result)
      fr.readAsDataURL(blob)
    })
    memCache.set(src, dataUrl)
    lsSet(src, dataUrl)
    resolved.value = dataUrl
  } catch { resolved.value = src }
}
watch(() => props.src, resolve, { immediate: true })
function onErr() { failed.value = true }
</script>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent);
  color: var(--accent-fg);
  font-weight: 600;
  flex: none;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.initials { font-size: .8em; }
.sm { width: 32px; height: 32px; font-size: 13px; }
.md { width: 36px; height: 36px; font-size: 14px; }
.lg { width: 64px; height: 64px; font-size: 22px; }
</style>
