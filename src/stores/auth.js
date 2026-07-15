// src/stores/auth.js
// Session + identity (keypair) + profile. Wraps lib/auth.
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import {
  loginWithGoogle, getAuthUser, ensureIdentity, logout as authLogout,
  getMyProfile, updateUsername, backupToDrive, restoreFromDrive,
  cacheKey, session, saveSetup,
} from '../lib/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    profile: null, // { username, display_name, avatar_url, setup_done }
    googleName: '',
    googleAvatar: '',
    initializing: true,
    identityStatus: null, // 'ok' | 'new' | 'need_restore' | 'error'
    setupDone: false,
    resolved: false,
  }),
  getters: {
    isAuthed: (s) => !!s.user,
    isReady: (s) => s.resolved && !s.initializing,
  },
  actions: {
    async init() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        this.user = data.session.user
        await this.resolveIdentity()
      } else {
        this.initializing = false
      }
      supabase.auth.onAuthStateChange((_e, session) => {
        if (session?.user) {
          this.user = session.user
          if (!this.resolved) this.resolveIdentity()
        } else {
          this.user = null
          this.profile = null
          this.resolved = false
          this.initializing = false
        }
      })
    },
    async resolveIdentity() {
      try {
        const r = await ensureIdentity()
        this.identityStatus = r.status
        this.setupDone = r.setupDone
        this.googleName = r.googleName || ''
        this.googleAvatar = r.googleAvatar || ''
        const p = await getMyProfile()
        this.profile = p
      } catch (e) {
        this.identityStatus = 'error'
        console.warn('ensureIdentity:', e.message)
      } finally {
        this.resolved = true
        this.initializing = false
      }
    },
    async login() { await loginWithGoogle() },
    async logout() { await authLogout(); this.user = null; this.profile = null; this.resolved = false },
    async editUsername(name) {
      await updateUsername(name)
      if (this.profile) this.profile.username = name
    },
    async backup() { return await backupToDrive() },
    async restore() {
      const key = await restoreFromDrive()
      if (!key) { this.identityStatus = 'new'; return } // backup hilang -> mulai baru
      // simpan key hasil restore ke session + localStorage
      session.privateKey = key
      cacheKey(key)
      this.identityStatus = 'ok'
    },
    // Setup awal (username wajib + backup, display/avatar opsional)
    async doSetup(payload) {
      await saveSetup(payload)
      this.setupDone = true
      this.profile = await getMyProfile()
      this.identityStatus = 'ok'
    },
    // Mulai dari nol (akun baru / backup hilang): generate keypair baru
    async startFresh() {
      try {
        const r = await ensureIdentity()
        this.identityStatus = r.status
        this.profile = await getMyProfile()
      } catch (e) {
        this.identityStatus = 'error'
        console.warn('startFresh:', e.message)
      }
    },
  },
})
