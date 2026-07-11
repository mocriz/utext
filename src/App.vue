<script setup>
import { ref } from 'vue'
import { supabase } from './lib/supabase'
import { ensureIdentity } from './lib/auth'
import LoginScreen from './components/LoginScreen.vue'

const user = ref(null)
const initializing = ref(true)

// onAuthStateChange FIRING dengan session saat ini (INITIAL_SESSION) ->
// jadi refresh tidak akan kehilangan session. Ini sumber kebenaran.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    user.value = session.user
    ensureIdentity().catch((e) => console.warn('ensureIdentity gagal:', e.message))
  } else {
    user.value = null
  }
  initializing.value = false
})

// Safety net: lepas initializing biar ga stuck Loading
setTimeout(() => { initializing.value = false }, 3000)
</script>

<template>
  <LoginScreen v-if="!initializing && !user" />
  <div v-else-if="initializing">Loading…</div>
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
