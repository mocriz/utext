<!-- src/components/LoginScreen.vue -->
<script setup>
import { ref } from 'vue'
import { loginWithGoogle } from '../lib/auth'

const loading = ref(false)
const err = ref('')

async function onLogin() {
  loading.value = true
  err.value = ''
  try {
    await loginWithGoogle()
    // redirect ke Google; baliknya App.vue handle ensureIdentity()
  } catch (e) {
    err.value = e.message
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <h1>utext</h1>
    <p>Encrypted chat. Login with Google.</p>
    <button :disabled="loading" @click="onLogin">
      {{ loading ? 'Redirecting…' : 'Continue with Google' }}
    </button>
    <p v-if="err" class="err">{{ err }}</p>
  </div>
</template>

<style scoped>
.login { max-width: 360px; margin: 20vh auto; text-align: center; }
button { padding: 12px 20px; border: none; border-radius: 8px; background: #1a73e8; color: #fff; font-size: 15px; cursor: pointer; }
.err { color: #c00; margin-top: 12px; }
</style>
