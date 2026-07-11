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
  },
})
