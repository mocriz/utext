<script setup>
import { ref } from 'vue'
import { supabase } from './lib/supabase'
import { ensureIdentity, identityStatus } from './lib/auth'
import LoginScreen from './components/LoginScreen.vue'
import ChatView from './components/ChatView.vue'

const user = ref(null)
const initializing = ref(true)
let identityResolved = false

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    user.value = session.user
    if (!identityResolved) {
      identityResolved = true
      ensureIdentity()
        .then((r) => { identityStatus.value = r.status })
        .catch((e) => { identityStatus.value = 'error'; console.warn('ensureIdentity:', e.message) })
        .finally(() => { initializing.value = false }) // baru tampilkan app setelah identity siap
    }
  } else {
    user.value = null
    initializing.value = false
    identityResolved = false
  }
})

setTimeout(() => { initializing.value = false }, 5000)
</script>

<template>
  <LoginScreen v-if="!initializing && !user" />
  <div v-else-if="initializing">Loading…</div>
  <ChatView v-else />
</template>

<style scoped>
</style>
