<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './lib/supabase'
import { ensureIdentity, identityStatus } from './lib/auth'
import LoginScreen from './components/LoginScreen.vue'
import ChatView from './components/ChatView.vue'

const user = ref(null)
const initializing = ref(true)
let identityResolved = false

async function resolveIdentity(sessionUser) {
  user.value = sessionUser
  if (identityResolved) return
  identityResolved = true
  initializing.value = true
  try {
    const r = await ensureIdentity()
    identityStatus.value = r.status
  } catch (e) {
    identityStatus.value = 'error'
    console.warn('ensureIdentity:', e.message)
  } finally {
    initializing.value = false
  }
}

// Fallback: pas reload (session udah ada), onAuthStateChange ga selalu fire.
onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) {
    await resolveIdentity(data.session.user)
  } else {
    initializing.value = false
  }
})

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    resolveIdentity(session.user)
  } else {
    user.value = null
    initializing.value = false
    identityResolved = false
  }
})
</script>

<template>
  <LoginScreen v-if="!initializing && !user" />
  <div v-else-if="initializing">Loading…</div>
  <ChatView v-else />
</template>

<style scoped>
</style>
