<script setup>
import { computed, ref, defineAsyncComponent } from 'vue'
import { useAuthStore } from './stores/auth'
import LoginScreen from './components/LoginScreen.vue'
import SetupScreen from './components/organisms/SetupScreen.vue'
import ToastHost from './components/atoms/ToastHost.vue'
import Icon from './components/atoms/Icon.vue'

const auth = useAuthStore()
const showApp = computed(() => auth.isReady && auth.isAuthed && auth.identityStatus !== 'need_restore' && auth.setupDone)
const showSetup = computed(() => auth.isReady && auth.isAuthed && auth.identityStatus === 'new' && !auth.setupDone)

// HIDDEN MODE: decoy 2048 dulu, chat di-lazy-load pas PIN benar
const HIDDEN = import.meta.env.VITE_HIDDEN_APP === 'true'
const revealed = ref(false)
// lazy-load chat biar gak ke-bundle saat decoy (stealth)
const AppShell = defineAsyncComponent(() => import('./components/templates/AppShell.vue'))
const Decoy2048 = defineAsyncComponent(() => import('./components/Decoy2048.vue'))
</script>

<template>
  <!-- HIDDEN MODE -->
  <template v-if="HIDDEN">
    <Decoy2048 v-if="!revealed" @reveal="revealed = true" />
    <template v-else>
      <LoginScreen v-if="!auth.isAuthed" @login="auth.login()" />
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
        <button v-if="auth.identityStatus === 'need_restore' || auth.identityStatus === 'new'" @click="auth.restore()" title="Restore dari Drive"><Icon name="mdi:cloud-download-outline" :size="18" /></button>
        <button @click="auth.startFresh()" v-if="auth.identityStatus === 'new' || auth.identityStatus === 'need_restore'" title="Mulai Baru"><Icon name="mdi:plus-circle-outline" :size="18" /></button>
        <button @click="auth.backup()" v-if="auth.identityStatus === 'new'" title="Backup Key Baru"><Icon name="mdi:cloud-upload-outline" :size="18" /></button>
      </div>
    </template>
  </template>

  <!-- NORMAL MODE -->
  <template v-else>
    <LoginScreen v-if="!auth.isAuthed" @login="auth.login()" />
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
      <button v-if="auth.identityStatus === 'need_restore' || auth.identityStatus === 'new'" @click="auth.restore()" title="Restore dari Drive"><Icon name="mdi:cloud-download-outline" :size="18" /></button>
      <button @click="auth.startFresh()" v-if="auth.identityStatus === 'new' || auth.identityStatus === 'need_restore'" title="Mulai Baru"><Icon name="mdi:plus-circle-outline" :size="18" /></button>
      <button @click="auth.backup()" v-if="auth.identityStatus === 'new'" title="Backup Key Baru"><Icon name="mdi:cloud-upload-outline" :size="18" /></button>
    </div>
  </template>

  <ToastHost />
</template>

<style>
.boot { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--fg); background: var(--bg); }
.boot button { padding: 10px 18px; border: none; border-radius: 8px; background: var(--accent); color: var(--accent-fg); font-weight: 600; cursor: pointer; }
</style>
