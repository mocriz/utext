<template>
  <div class="setup">
    <div class="card">
      <h1>Setup Akun</h1>
      <p class="sub">Lengkapi untuk mulai chat. Display name & foto bisa di-skip (pakai default Google).</p>

      <!-- Photo -->
      <div class="field">
        <label>Foto profil <span class="opt">(opsional)</span></label>
        <div class="photo-row">
          <Avatar :src="photoUrl || googleAvatar" :name="displayName || username || 'U'" size="lg" />
          <div class="photo-actions">
            <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatar" />
            <BaseButton size="sm" variant="subtle" @click="avatarInput?.click()" title="Pilih foto"><Icon name="mdi:image-outline" :size="18" /></BaseButton>
            <span class="muted small">{{ avatarName || 'default dari Google' }}</span>
          </div>
        </div>
      </div>

      <!-- Display name -->
      <div class="field">
        <label>Nama tampilan <span class="opt">(opsional)</span></label>
        <TextInput v-model="displayName" :placeholder="googleName || 'Nama tampilan'" />
        <p class="muted small">Kosongkan untuk menggunakan nama Google: {{ googleName || '-' }}</p>
      </div>

      <!-- Username (wajib) -->
      <div class="field">
        <label>Username <span class="req">*</span></label>
        <div class="inline">
          <TextInput v-model="username" placeholder="username" @update:model-value="onUsernameType" />
        </div>
        <p v-if="usernameStatus === 'checking'" class="hint">Memeriksa ketersediaan…</p>
        <p v-else-if="usernameStatus === 'available'" class="ok">Username tersedia</p>
        <p v-else-if="usernameStatus === 'taken'" class="err">Username sudah digunakan</p>
        <p v-else-if="usernameStatus === 'invalid'" class="err">Hanya huruf kecil, angka, dan garis bawah (1-30 karakter)</p>
        <p v-else-if="usernameErr" class="err">{{ usernameErr }}</p>
      </div>

      <!-- Backup (wajib) -->
      <div class="field">
        <label>Backup Key ke Drive <span class="req">*</span></label>
        <div class="row">
          <span class="muted small">Wajib diisi — simpan kunci rahasia ke Google Drive agar bisa dipulihkan di perangkat lain.</span>
          <BaseButton size="sm" variant="subtle" :disabled="backing" @click="onBackup" title="Backup">
            <Icon name="mdi:cloud-upload-outline" :size="18" />
          </BaseButton>
        </div>
        <p v-if="backupErr" class="err">{{ backupErr }}</p>
      </div>

      <BaseButton variant="primary" :disabled="!canStart" @click="start" title="Mulai">
        <Icon name="mdi:check-circle-outline" :size="20" />
      </BaseButton>
      <p v-if="!canStart" class="muted small center">Username & backup Drive wajib diisi.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Avatar from '../atoms/Avatar.vue'
import TextInput from '../atoms/TextInput.vue'
import BaseButton from '../atoms/BaseButton.vue'
import { isUsernameAvailable, backupToDrive } from '../../lib/auth'

const props = defineProps({
  googleName: { type: String, default: '' },
  googleAvatar: { type: String, default: '' },
})
const emit = defineEmits(['done'])

const username = ref('')
const displayName = ref(props.googleName || '')
const usernameStatus = ref('')
const usernameErr = ref('')
const backing = ref(false)
const backedUp = ref(false)
const backupErr = ref('')
const avatarInput = ref(null)
const avatarName = ref('')
const photoUrl = ref('')
const pendingAvatar = ref(null)

const USER_RE = /^[a-z0-9_]{1,30}$/
const canStart = computed(() => USER_RE.test(username.value) && usernameStatus.value === 'available' && backedUp.value)

let checkTimer = null
function onUsernameType(v) {
  username.value = v
  const val = (v || '').trim()
  if (!val) { usernameStatus.value = ''; return }
  if (!USER_RE.test(val)) { usernameStatus.value = 'invalid'; return }
  usernameStatus.value = 'checking'
  clearTimeout(checkTimer)
  checkTimer = setTimeout(async () => {
    try { usernameStatus.value = (await isUsernameAvailable(val)) ? 'available' : 'taken' }
    catch { usernameStatus.value = '' }
  }, 400)
}

function onAvatar(e) {
  const f = e.target.files?.[0]
  if (!f) return
  avatarName.value = f.name
  photoUrl.value = URL.createObjectURL(f)
  pendingAvatar.value = f
}

async function onBackup() {
  backing.value = true; backupErr.value = ''
  try { await backupToDrive(); backedUp.value = true }
  catch (e) { backupErr.value = e.message }
  backing.value = false
}

async function start() {
  if (!canStart.value) return
  const payload = { username: username.value }
  if (displayName.value.trim()) payload.display_name = displayName.value.trim()
  payload.google_name = props.googleName
  if (pendingAvatar.value) payload.avatar = pendingAvatar.value
  emit('done', payload)
}
</script>

<style scoped>
.setup { height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 16px; }
.card { width: 100%; max-width: 440px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); }
h1 { margin: 0 0 4px; font-size: 22px; }
.sub { color: var(--muted); font-size: 13px; margin: 0 0 20px; }
.field { margin-bottom: 18px; }
.field > label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 7px; color: var(--fg); }
.req { color: var(--danger); }
.opt { color: var(--muted); font-weight: 400; font-size: 11px; }
.inline { display: flex; gap: 10px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.photo-row { display: flex; align-items: center; gap: 14px; }
.photo-actions { display: flex; flex-direction: column; gap: 6px; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.hint { color: var(--muted); font-size: 12px; }
.ok { color: #16a34a; font-size: 12px; }
.err { color: var(--danger); font-size: 12px; }
.center { text-align: center; }
</style>
