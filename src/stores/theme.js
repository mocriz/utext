// src/stores/theme.js
import { defineStore } from 'pinia'

const PRESETS = ['default', 'midnight', 'solar', 'rose', 'mono']

function applyVars(vars) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars || {})) {
    root.style.setProperty(k, v)
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: 'light', // light | dark
    preset: 'default', // default | midnight | solar | rose | mono
    custom: null, // { accent, bubbleMe } kalau mode custom
  }),
  getters: {
    presets: () => PRESETS,
  },
  actions: {
    hydrate() {
      try {
        const saved = JSON.parse(localStorage.getItem('utext_theme') || 'null')
        if (saved) {
          this.mode = saved.mode || 'light'
          this.preset = saved.preset || 'default'
          this.custom = saved.custom || null
        } else {
          // default ikut system
          if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
            this.mode = 'dark'
          }
        }
      } catch {}
      this.apply()
    },
    persist() {
      localStorage.setItem('utext_theme', JSON.stringify({
        mode: this.mode, preset: this.preset, custom: this.custom,
      }))
    },
    apply() {
      const root = document.documentElement
      root.setAttribute('data-theme', this.mode)
      root.setAttribute('data-preset', this.preset)
      if (this.custom) {
        applyVars({ '--accent': this.custom.accent, '--bubble-me': this.custom.bubbleMe })
      } else {
        applyVars({ '--accent': '', '--bubble-me': '' })
      }
    },
    setMode(mode) { this.mode = mode; this.apply(); this.persist() },
    setPreset(preset) { this.preset = preset; this.custom = null; this.apply(); this.persist() },
    setCustom({ accent, bubbleMe }) {
      this.custom = { accent, bubbleMe }
      this.apply(); this.persist()
    },
    toggle() { this.setMode(this.mode === 'light' ? 'dark' : 'light') },
  },
})
