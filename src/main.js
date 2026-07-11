import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { supabase } from './lib/supabase'
import { useThemeStore } from './stores/theme'
import { useAuthStore } from './stores/auth'
import './styles/tokens.css'
import './styles/themes.css'

const app = createApp(App)
app.use(createPinia())

// apply theme sebelum mount biar ga flash
const theme = useThemeStore()
theme.hydrate()

// init auth store (session + identity) — fire & forget, App.vue nunggu via getter
const auth = useAuthStore()
auth.init()

app.mount('#app')

// expose supabase buat debug (opsional)
window.__supabase = supabase