<template>
  <teleport to="body">
    <div v-if="open" class="sheet-backdrop" @click="$emit('close')">
      <div class="sheet" @click.stop>
        <header class="sh">
          <span>{{ title }}</span>
          <IconButton icon="✕" @click="$emit('close')" />
        </header>

        <div class="body">
          <!-- PROFILE -->
          <template v-if="section === 'profile'">
            <div class="prof">
              <Avatar :src="profile?.avatar_url" :name="profile?.username || profile?.display_name" size="lg" />
              <div>
                <div class="big">@{{ profile?.username }}</div>
                <div class="muted">{{ profile?.display_name }}</div>
              </div>
            </div>
            <label class="lbl">Username</label>
            <div class="inline">
              <TextInput v-model="usernameDraft" placeholder="username" />
              <BaseButton size="sm" variant="primary" :disabled="!usernameDraft || saving" @click="saveUsername">Simpan</BaseButton>
            </div>
            <p v-if="usernameErr" class="err">{{ usernameErr }}</p>
          </template>

          <!-- ACCOUNT -->
          <template v-else-if="section === 'account'">
            <label class="lbl">Display name</label>
            <TextInput v-model="displayDraft" placeholder="Nama tampilan" />
            <BaseButton size="sm" variant="primary" :disabled="saving" @click="saveDisplay" style="margin-top:8px">Simpan</BaseButton>

            <label class="lbl" style="margin-top:18px">Foto profil</label>
            <div class="inline">
              <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatar" />
              <BaseButton size="sm" variant="subtle" @click="avatarInput?.click()">Pilih foto</BaseButton>
              <span class="muted">{{ avatarName || 'default dari Google' }}</span>
            </div>

            <label class="lbl" style="margin-top:18px">Password</label>
            <TextInput model-value="" type="password" disabled placeholder="••••••••" />
            <p class="muted small">Akun login via Google — password diatur di akun Google, bukan di sini.</p>

            <div class="danger-zone">
              <div class="muted small">Hapus akun (soft delete — chat tetap bisa dibaca lawan, login Gmail sama bisa kembali)</div>
              <BaseButton variant="danger" :disabled="deleting" @click="confirmDelete">Hapus akun</BaseButton>
            </div>
          </template>

          <!-- SETTINGS -->
          <template v-else-if="section === 'settings'">
            <label class="lbl">Backup & Restore</label>
            <div class="row">
              <span class="muted small">Simpan private key ke Google Drive (cross-device)</span>
              <BaseButton size="sm" variant="subtle" :disabled="backing" @click="$emit('backup')">Backup</BaseButton>
            </div>
            <div class="row" v-if="identityStatus === 'need_restore' || identityStatus === 'new'">
              <span class="muted small">Pulihkan key dari Drive</span>
              <BaseButton size="sm" variant="subtle" :disabled="backing" @click="$emit('restore')">Restore</BaseButton>
            </div>

            <label class="lbl" style="margin-top:18px">Read Receipt</label>
            <div class="row">
              <span class="muted small">Tampilkan centang 2 biru saat pesan dibaca</span>
              <button class="toggle" :class="{ on: prefs.readReceipt }" @click="toggle('readReceipt')"><span /></button>
            </div>

            <label class="lbl" style="margin-top:18px">Online Indicator</label>
            <div class="row">
              <span class="muted small">Tampilkan status online ke lawan bicara</span>
              <button class="toggle" :class="{ on: prefs.onlineIndicator }" @click="toggle('onlineIndicator')"><span /></button>
            </div>

            <label class="lbl" style="margin-top:18px">Theme</label>
            <div class="themes">
              <button v-for="m in ['light','dark']" :key="m" class="chip" :class="{ active: theme.mode === m }" @click="theme.setMode(m)">{{ m }}</button>
            </div>
            <label class="lbl" style="margin-top:12px">Preset</label>
            <div class="themes">
              <button v-for="p in theme.presets" :key="p" class="chip" :class="{ active: theme.preset === p && !theme.custom }" @click="theme.setPreset(p)">{{ p }}</button>
            </div>
            <label class="lbl" style="margin-top:12px">Custom warna</label>
            <div class="inline">
              <input type="color" v-model="accent" @input="applyCustom" />
              <input type="color" v-model="bubble" @input="applyCustom" />
            </div>
          </template>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import IconButton from '../atoms/IconButton.vue'
import Avatar from '../atoms/Avatar.vue'
import TextInput from '../atoms/TextInput.vue'
import BaseButton from '../atoms/BaseButton.vue'
import { useThemeStore } from '../../stores/theme'

const props = defineProps({
  open: Boolean,
  section: { type: String, default: 'profile' }, // profile | account | settings
  profile: { type: Object, default: null },
  prefs: { type: Object, default: () => ({ readReceipt: true, onlineIndicator: true }) },
  identityStatus: { type: String, default: '' },
})
const emit = defineEmits(['close', 'backup', 'restore', 'save-username', 'save-display', 'avatar', 'delete-account', 'update:prefs'])
const theme = useThemeStore()

const usernameDraft = ref(props.profile?.username || '')
const displayDraft = ref(props.profile?.display_name || '')
const usernameErr = ref('')
const saving = ref(false)
const deleting = ref(false)
const backing = ref(false)
const avatarInput = ref(null)
const avatarName = ref('')
const accent = ref('#1a73e8')
const bubble = ref('#d9fdd3')

const title = computed(() => ({ profile: 'Profil', account: 'Akun', settings: 'Pengaturan' }[props.section] || ''))

watch(() => props.profile, (p) => {
  if (p) { usernameDraft.value = p.username || ''; displayDraft.value = p.display_name || '' }
}, { immediate: true })

function toggle(key) {
  const next = { ...props.prefs, [key]: !props.prefs[key] }
  emit('update:prefs', next)
}
function applyCustom() {
  theme.setCustom({ accent: accent.value, bubbleMe: bubble.value })
}
async function saveUsername() {
  saving.value = true; usernameErr.value = ''
  try { await emit('save-username', usernameDraft.value.trim()); } catch (e) { usernameErr.value = e.message }
  saving.value = false
}
async function saveDisplay() {
  saving.value = true
  await emit('save-display', displayDraft.value.trim())
  saving.value = false
}
function onAvatar(e) { const f = e.target.files?.[0]; if (f) { avatarName.value = f.name; emit('avatar', f) } }
function confirmDelete() { if (confirm('Hapus akun? Chat lawan tetap bisa dibaca. Login Gmail sama bisa kembali.')) emit('delete-account') }
</script>

<style scoped>
.sheet-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 80; display: flex; align-items: center; justify-content: center; padding: 16px; }
.sheet { width: 100%; max-width: 460px; max-height: 88vh; overflow-y: auto; background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); }
.sh { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--border); font-weight: 700; }
.body { padding: 16px; }
.prof { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.big { font-weight: 700; font-size: 16px; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.lbl { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin: 12px 0 6px; text-transform: uppercase; letter-spacing: .03em; }
.inline { display: flex; align-items: center; gap: 10px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; }
.err { color: var(--danger); font-size: 12px; }
.themes { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 7px 12px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); color: var(--fg); cursor: pointer; font-size: 13px; text-transform: capitalize; }
.chip.active { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.toggle { width: 44px; height: 24px; border-radius: 12px; border: none; background: var(--border); position: relative; cursor: pointer; transition: background .15s; }
.toggle.on { background: var(--accent); }
.toggle span { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: left .15s; }
.toggle.on span { left: 22px; }
.danger-zone { margin-top: 22px; padding: 14px; border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent); border-radius: var(--radius); display: flex; flex-direction: column; gap: 8px; }
</style>
