// src/stores/prefs.js
// User preferences: read receipt + online indicator toggles.
import { defineStore } from 'pinia'

export const usePrefsStore = defineStore('prefs', {
  state: () => ({
    readReceipt: true,
    onlineIndicator: true,
  }),
  actions: {
    hydrate() {
      try {
        const s = JSON.parse(localStorage.getItem('utext_prefs') || 'null')
        if (s) { this.readReceipt = s.readReceipt ?? true; this.onlineIndicator = s.onlineIndicator ?? true }
      } catch {}
    },
    set(partial) {
      Object.assign(this, partial)
      localStorage.setItem('utext_prefs', JSON.stringify({
        readReceipt: this.readReceipt, onlineIndicator: this.onlineIndicator,
      }))
    },
  },
})
