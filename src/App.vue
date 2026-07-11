<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './lib/supabase'
import { getAuthUser, ensureIdentity } from './lib/auth'
import LoginScreen from './components/LoginScreen.vue'

const ready = ref(false)
const user = ref(null)

onMounted(async () => {
  const u = await getAuthUser()
  if (u) {
    user.value = u
    ready.value = true // UI langsung tampil, identity di-load background
    ensureIdentity().catch((e) => console.warn('ensureIdentity gagal:', e.message))
  } else {
    ready.value = true
  }
})

supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    user.value = session.user
    await ensureIdentity()
    ready.value = true
  } else {
    user.value = null
  }
})
</script>

<template>
  <LoginScreen v-if="ready && !user" />
  <div v-else-if="!ready">Loading…</div>
  <div v-else class="app">
    <header>utext — logged in as {{ user.email }}</header>
    <main>Chat UI coming in Phase 5+</main>
  </div>
</template>

<style scoped>
.app { font-family: sans-serif; }
header { padding: 12px 16px; background: #f0f0f0; border-bottom: 1px solid #ddd; }
main { padding: 16px; }
</style>
