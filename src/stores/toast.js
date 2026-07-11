// src/stores/toast.js
// Sistem notifikasi toast (success / error / info)
import { defineStore } from 'pinia'

let nextId = 1

export const useToastStore = defineStore('toast', {
  state: () => ({ items: [] }),
  actions: {
    push(message, type = 'info', timeout = 3000) {
      const id = nextId++
      this.items.push({ id, message, type })
      if (timeout) setTimeout(() => this.dismiss(id), timeout)
      return id
    },
    success(message) { return this.push(message, 'success') },
    error(message) { return this.push(message, 'error', 4000) },
    info(message) { return this.push(message, 'info') },
    dismiss(id) { this.items = this.items.filter((t) => t.id !== id) },
  },
})
