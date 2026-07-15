<script setup>
import { computed } from 'vue'
import { useAuthStore } from './stores/auth'
import LoginScreen from './components/LoginScreen.vue'
import SetupScreen from './components/organisms/SetupScreen.vue'
import AppShell from './components/templates/AppShell.vue'
import ToastHost from './components/atoms/ToastHost.vue'

const auth = useAuthStore()
const showApp = computed(() => auth.isReady && auth.isAuthed && auth.identityStatus !== 'need_restore' && auth.setupDone)
const showSetup = computed(() => auth.isReady && auth.isAuthed && auth.identityStatus === 'new' && !auth.setupDone)
</script>

<template>
  <LoginScreen
    v-if="!auth.isAuthed"
    @login="auth.login()"
  />
  <div v-else-if="!auth.isReady" class="boot">Memuat…</div>
  <SetupScreen
    v-else-if="showSetup"
    :google-name="auth.googleName"
    :google-avatar="auth.googleAvatar"
    @done="auth.doSetup"
  />
  <AppShell v-else-if="showApp" />
  <div v-else class="boot">
    <p>Kunci belum tersedia.</p>
    <button v-if="auth.identityStatus === 'need_restore' || auth.identityStatus === 'new'" @click="auth.restore()">Restore dari Drive</button>
    <button @click="auth.startFresh()" v-if="auth.identityStatus === 'new' || auth.identityStatus === 'need_restore'">Mulai Baru</button>
    <button @click="auth.backup()" v-if="auth.identityStatus === 'new'">Backup Key Baru</button>
  </div>
  <ToastHost />
</template>

<style>
.boot { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--fg); background: var(--bg); }
.boot button { padding: 10px 18px; border: none; border-radius: 8px; background: var(--accent); color: var(--accent-fg); font-weight: 600; cursor: pointer; }
</style>
