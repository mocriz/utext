<template>
  <div class="login">
    <div class="brand">
      <div class="logo"><Icon name="mdi:shield-lock-outline" :size="34" /></div>
      <h1>uText</h1>
      <p class="tagline">Pesan terenkripsi end-to-end. Hanya kamu dan lawan bicara yang bisa membacanya.</p>
    </div>

    <div class="features">
      <div class="feat">
        <Icon name="mdi:lock-outline" :size="22" />
        <div>
          <div class="ft">Enkripsi penuh</div>
          <div class="fs">Kunci rahasia hanya di perangkatmu. Server tidak bisa membaca isi chat.</div>
        </div>
      </div>
      <div class="feat">
        <Icon name="mdi:google-drive" :size="22" />
        <div>
          <div class="ft">Backup ke Google Drive</div>
          <div class="fs">Simpan kunci cadangan dengan aman, bisa dipulihkan di perangkat lain.</div>
        </div>
      </div>
      <div class="feat">
        <Icon name="mdi:incognito" :size="22" />
        <div>
          <div class="ft">Tanpa nomor telepon</div>
          <div class="fs">Cukup login dengan Google. Username buat mencari dan mengobrol.</div>
        </div>
      </div>
    </div>

    <button class="google" :disabled="loading" @click="onLogin">
      <Icon name="mdi:google" :size="20" />
      <span>{{ loading ? 'Mengalihkan…' : 'Lanjut dengan Google' }}</span>
    </button>

    <p class="foot">Dengan melanjutkan, kamu menyetujui pencadangan kunci ke Google Drive. Pesan dienkripsi dengan standar X25519.</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Icon from './atoms/Icon.vue'

const emit = defineEmits(['login'])
const loading = ref(false)
function onLogin() { loading.value = true; emit('login') }
</script>

<style scoped>
.login {
  max-width: 380px; margin: auto; min-height: 100vh;
  display: flex; flex-direction: column; justify-content: center; gap: 28px;
  padding: 32px 24px;
}
.brand { text-align: center; }
.logo {
  width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);
}
h1 { font-size: 28px; font-weight: 700; letter-spacing: -.02em; margin: 0 0 8px; }
.tagline { color: var(--muted); font-size: 14px; line-height: 1.5; margin: 0; }
.features { display: flex; flex-direction: column; gap: 16px; }
.feat { display: flex; gap: 14px; align-items: flex-start; }
.feat :deep(svg) { color: var(--accent); flex: none; margin-top: 2px; }
.ft { font-weight: 600; font-size: 14px; }
.fs { color: var(--muted); font-size: 13px; line-height: 1.45; margin-top: 2px; }
.google {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 13px 18px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); color: var(--fg); font-size: 15px; font-weight: 600; cursor: pointer;
  transition: background 140ms var(--ease-out), border-color 140ms var(--ease-out), transform 140ms var(--ease-out);
}
.google:hover:not(:disabled) { background: var(--surface-2); border-color: var(--accent); }
.google:active:not(:disabled) { transform: scale(0.98); }
.google:disabled { opacity: .6; cursor: default; }
.foot { color: var(--muted); font-size: 12px; line-height: 1.5; text-align: center; margin: 0; }
</style>
