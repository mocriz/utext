// src/stores/conversations.js
// Daftar conversation + unread count per room (client-side, E2EE-safe).
import { defineStore } from 'pinia'
import { listConversations } from '../lib/chat'

export const useConversationsStore = defineStore('conversations', {
  state: () => ({
    items: [], // { conversationId, partner: {id,username,display_name,avatar_url}, lastMessage, unread }
    loaded: false,
  }),
  getters: {
    totalUnread: (s) => s.items.reduce((n, c) => n + (c.unread || 0), 0),
    byId: (s) => (id) => s.items.find((c) => c.conversationId === id),
  },
  actions: {
    async load() {
      this.items = await listConversations()
      this.loaded = true
    },
    upsert(conv) {
      const i = this.items.findIndex((c) => c.conversationId === conv.conversationId)
      if (i >= 0) this.items[i] = { ...this.items[i], ...conv }
      else this.items.push(conv)
      this.reorder()
    },
    setPartner(conversationId, partner) {
      const c = this.items.find((x) => x.conversationId === conversationId)
      if (c) c.partner = partner
    },
    bumpUnread(conversationId, by = 1) {
      const c = this.items.find((x) => x.conversationId === conversationId)
      if (c) c.unread = (c.unread || 0) + by
    },
    clearUnread(conversationId) {
      const c = this.items.find((x) => x.conversationId === conversationId)
      if (c) c.unread = 0
    },
    setLast(conversationId, text) {
      const c = this.items.find((x) => x.conversationId === conversationId)
      if (c) { c.lastMessage = text; c._ts = new Date().toISOString(); this.reorder() }
    },
    // reorder by lastMessage timestamp (recent di atas). lastMessage diset saat kirim/terima.
    reorder() {
      this.items.sort((a, b) => {
        const ta = a._ts || '0'
        const tb = b._ts || '0'
        return tb.localeCompare(ta)
      })
    },
  },
})
