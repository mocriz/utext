// src/stores/ui.js
// Global UI state: active room, settings panel, mobile view.
import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    activeRoomId: null,
    settingsOpen: false,
    mobileView: 'list', // list | chat (mobile only)
  }),
  actions: {
    openRoom(id) {
      this.activeRoomId = id
      this.mobileView = 'chat'
    },
    closeRoom() {
      this.activeRoomId = null
      this.mobileView = 'list'
    },
    toggleSettings(v) { this.settingsOpen = v ?? !this.settingsOpen },
  },
})
