<template>
  <teleport to="body">
    <div v-if="open" class="sheet-backdrop" @click="$emit('close')">
      <div class="sheet" @click.stop>
        <header class="sh">
          <button class="ic" title="Tutup" @click="$emit('close')">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <span class="title">Pengaturan</span>
        </header>

        <div class="body">
          <!-- nav -->
          <nav class="nav">
            <button class="nav-item" :class="{ active: section === 'profile' }" @click="section = 'profile'">
              <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5z" /></svg>
              <span>Profil</span>
            </button>
            <button class="nav-item" :class="{ active: section === 'appearance' }" @click="section = 'appearance'">
              <svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 100 18c1 0 1.5-1 1.5-2 0-1.5 1-2 2-2H18a3 3 0 003-3c0-5-4-9-9-9zm-4 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 4a3 3 0 100-6 3 3 0 000 6z" /></svg>
              <span>Tampilan</span>
            </button>
            <button class="nav-item" :class="{ active: section === 'privacy' }" @click="section = 'privacy'">
              <svg viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4zm0 6a2 2 0 012 2v1h1v5H9v-5h1v-1a2 2 0 012-2z" /></svg>
              <span>Privasi &amp; Akun</span>
            </button>
          </nav>

          <!-- content -->
          <div class="content">
            <!-- PROFIL -->
            <section v-if="section === 'profile'">
              <div class="profile-head">
                <Avatar :src="profile?.avatar_url" :name="profile?.username || profile?.display_name" size="lg" />
                <div>
                  <div class="big">@{{ profile?.username }}</div>
                  <div class="muted">{{ profile?.display_name }}</div>
                </div>
              </div>

              <div class="field">
                <label>Username</label>
                <div class="inline">
                  <TextInput v-model="usernameDraft" placeholder="username" @update:model-value="onUsernameType" />
                  <BaseButton size="sm" variant="primary" :disabled="!usernameDraft || saving || usernameStatus === 'taken'" @click="saveUsername">Simpan</BaseButton>
                </div>
                <p v-if="usernameStatus === 'checking'" class="hint">mengecek…</p>
                <p v-else-if="usernameStatus === 'available'" class="ok">✓ tersedia</p>
                <p v-else-if="usernameStatus === 'taken'" class="err">✗ sudah dipakai</p>
                <p v-else-if="usernameStatus === 'invalid'" class="err">✗ hanya a-z 0-9 _ (1-30)</p>
                <p v-else-if="usernameErr" class="err">{{ usernameErr }}</p>
              </div>

              <div class="field">
                <label>Nama tampilan</label>
                <TextInput v-model="displayDraft" placeholder="Nama tampilan" />
                <BaseButton size="sm" variant="primary" :disabled="saving" style="margin-top:8px" @click="saveDisplay">Simpan</BaseButton>
              </div>

              <div class="field">
                <label>Foto profil</label>
                <div class="inline">
                  <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatar" />
                  <BaseButton size="sm" variant="subtle" @click="avatarInput?.click()">Pilih foto</BaseButton>
                  <span class="muted small">{{ avatarName || 'default dari Google' }}</span>
                </div>
              </div>

              <div class="field">
                <label>Password</label>
                <TextInput model-value="" type="password" disabled placeholder="••••••••" />
                <p class="muted small">Akun login via Google — password diatur di akun Google.</p>
              </div>
            </section>

            <!-- TAMPILAN -->
            <section v-else-if="section === 'appearance'">
              <div class="field">
                <label>Mode</label>
                <div class="chips">
                  <button v-for="m in ['light','dark']" :key="m" class="chip" :class="{ active: theme.mode === m }" @click="theme.setMode(m)">{{ m }}</button>
                </div>
              </div>
              <div class="field">
                <label>Preset</label>
                <div class="chips">
                  <button v-for="p in theme.presets" :key="p" class="chip" :class="{ active: theme.preset === p && !theme.custom }" @click="theme.setPreset(p)">{{ p }}</button>
                </div>
              </div>
              <div class="field">
                <label>Warna kustom</label>
                <div class="inline">
                  <label class="swatch"><input type="color" v-model="accent" @input="applyCustom" /> Aksen</label>
                  <label class="swatch"><input type="color" v-model="bubble" @input="applyCustom" /> Bubble</label>
                </div>
              </div>
            </section>

            <!-- PRIVASI & AKUN -->
            <section v-else-if="section === 'privacy'">
              <div class="field">
                <label>Backup &amp; Restore</label>
                <div class="row">
                  <span class="muted small">Simpan private key ke Google Drive (cross-device)</span>
                  <BaseButton size="sm" variant="subtle" :disabled="backing" @click="$emit('backup')">Backup</BaseButton>
                </div>
                <div class="row" v-if="identityStatus === 'need_restore' || identityStatus === 'new'">
                  <span class="muted small">Pulihkan key dari Drive</span>
                  <BaseButton size="sm" variant="subtle" :disabled="backing" @click="$emit('restore')">Restore</BaseButton>
                </div>
              </div>

              <div class="field">
                <label>Read Receipt</label>
                <div class="row">
                  <span class="muted small">Tampilkan centang biru saat pesan dibaca</span>
                  <Toggle :on="prefs.readReceipt" @click="toggle('readReceipt')" />
                </div>
              </div>

              <div class="field">
                <label>Online Indicator</label>
                <div class="row">
                  <span class="muted small">Tampilkan status online ke lawan</span>
                  <Toggle :on="prefs.onlineIndicator" @click="toggle('onlineIndicator')" />
                </div>
              </div>

              <div class="field danger-zone">
                <label>Hapus akun</label>
                <p class="muted small">Soft delete — chat lawan tetap bisa dibaca, login Gmail sama bisa kembali.</p>
                <BaseButton variant="danger" :disabled="deleting" @click="confirmDelete">Hapus akun</BaseButton>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import Avatar from '../atoms/Avatar.vue'
import TextInput from '../atoms/TextInput.vue'
import BaseButton from '../atoms/BaseButton.vue'
import Toggle from '../atoms/Toggle.vue'
import { useThemeStore } from '../../stores/theme'
import { isUsernameAvailable } from '../../lib/auth'

const props = defineProps({
  open: Boolean,
  profile: { type: Object, default: null },
  prefs: { type: Object, default: () => ({ readReceipt: true, onlineIndicator: true }) },
  identityStatus: { type: String, default: '' },
})
const emit = defineEmits(['close', 'backup', 'restore', 'save-username', 'save-display', 'avatar', 'delete-account', 'update:prefs'])
const theme = useThemeStore()

const section = ref('profile')
const usernameDraft = ref(props.profile?.username || '')
const displayDraft = ref(props.profile?.display_name || '')
const usernameErr = ref('')
const usernameStatus = ref('') // '' | checking | available | taken | invalid
const saving = ref(false)
const deleting = ref(false)
const backing = ref(false)
const avatarInput = ref(null)
const avatarName = ref('')
const accent = ref('#1a73e8')
const bubble = ref('#d9fdd3')

const USER_RE = /^[a-z0-9_]{1,30}$/

watch(() => props.profile, (p) => {
  if (p) { usernameDraft.value = p.username || ''; displayDraft.value = p.display_name || '' }
}, { immediate: true })

let checkTimer = null
async function onUsernameType(v) {
  usernameDraft.value = v
  const val = (v || '').trim()
  if (!val) { usernameStatus.value = ''; return }
  if (!USER_RE.test(val)) { usernameStatus.value = 'invalid'; return }
  if (val === props.profile?.username) { usernameStatus.value = ''; return }
  usernameStatus.value = 'checking'
  clearTimeout(checkTimer)
  checkTimer = setTimeout(async () => {
    try {
      const ok = await isUsernameAvailable(val)
      usernameStatus.value = ok ? 'available' : 'taken'
    } catch { usernameStatus.value = '' }
  }, 400)
}

function toggle(key) { emit('update:prefs', { ...props.prefs, [key]: !props.prefs[key] }) }
function applyCustom() { theme.setCustom({ accent: accent.value, bubbleMe: bubble.value }) }
async function saveUsername() {
  const val = usernameDraft.value.trim()
  if (!USER_RE.test(val)) { usernameStatus.value = 'invalid'; return }
  if (usernameStatus.value === 'taken') return
  saving.value = true; usernameErr.value = ''
  try { await emit('save-username', val); usernameStatus.value = '' } catch (e) { usernameErr.value = e.message }
  saving.value = false
}
async function saveDisplay() { saving.value = true; await emit('save-display', displayDraft.value.trim()); saving.value = false }
function onAvatar(e) { const f = e.target.files?.[0]; if (f) { avatarName.value = f.name; emit('avatar', f) } }
function confirmDelete() { if (confirm('Hapus akun? Chat lawan tetap bisa dibaca. Login Gmail sama bisa kembali.')) emit('delete-account') }
</script>

<style scoped>
.sheet-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 80; display: flex; align-items: center; justify-content: center; padding: 16px; }
.sheet { width: 100%; max-width: 720px; max-height: 90vh; display: flex; flex-direction: column; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.sh { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.sh .title { font-weight: 700; font-size: 16px; }
.ic { width: 36px; height: 36px; border: none; background: transparent; color: var(--muted); border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.ic:hover { background: var(--surface-2); color: var(--fg); }
.ic svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.body { display: flex; flex: 1; min-height: 0; }
.nav { width: 200px; flex: none; border-right: 1px solid var(--border); padding: 10px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; background: transparent; color: var(--fg); font-size: 14px; text-align: left; cursor: pointer; border-radius: var(--radius-sm); }
.nav-item svg { width: 18px; height: 18px; fill: currentColor; }
.nav-item:hover { background: var(--surface-2); }
.nav-item.active { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); font-weight: 600; }
.content { flex: 1; padding: 20px 24px; overflow-y: auto; }
.profile-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.big { font-weight: 700; font-size: 16px; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.field { margin-bottom: 22px; }
.field > label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: 8px; }
.inline { display: flex; align-items: center; gap: 10px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
.err { color: var(--danger); font-size: 12px; }
.hint { color: var(--muted); font-size: 12px; }
.ok { color: #16a34a; font-size: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 8px 14px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); color: var(--fg); cursor: pointer; font-size: 13px; text-transform: capitalize; }
.chip.active { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.swatch { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
.swatch input { width: 32px; height: 32px; border: none; background: none; cursor: pointer; }
.danger-zone { padding: 16px; border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent); border-radius: var(--radius); display: flex; flex-direction: column; gap: 8px; }
@media (max-width: 600px) {
  .body { flex-direction: column; }
  .nav { width: 100%; flex-direction: row; border-right: none; border-bottom: 1px solid var(--border); overflow-x: auto; }
  .nav-item span { display: none; }
  .content { padding: 16px; }
}
</style>
