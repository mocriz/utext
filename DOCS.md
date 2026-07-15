# utext — Documentation & Maintenance Guide

Chat E2EE 1-on-1, backendless (Supabase BaaS), static SPA (Vue 3 + Vite).
Semua fitur jalan di free tier Supabase, NO billing, personal use.

---

## 1. Arsitektur Singkat

| Layer | Tech |
|-------|------|
| Frontend | Vue 3 (`<script setup>`), Vite, Pinia |
| Backend | Supabase: Postgres + Auth + Realtime + Storage |
| Auth | Google OAuth |
| Enkripsi | X25519 (libsodium) — keypair RANDOM, tidak diturunkan dari UID |
| Key backup | Raw private key → Google Drive (tombol manual) + cache localStorage |
| Media | Enkripsi di client → upload ke bucket `media` (private) |
| Deploy | Static SPA (Vercel / Netlify / mana saja) |

**Alur enkripsi:** saat login pertama, generate keypair X25519. Public key disimpan di
`profiles.public_key`. Private key di localStorage (`utext_private_key`) + bisa di-backup
ke Drive (`utext-key.backup.json` di root Drive). Setiap pesan: `sharedSecret(publicKey lawan,
privateKey kita)` → encrypt text/media. Lawan decrypt pakai secret yang sama.

**Penting:** private key TIDAK pernah ke Supabase. Kalau hilang (device baru + belum backup)
→ chat lama tidak bisa dibaca (fitur "Restore dari Drive" menghandle ini).

---

## 2. Struktur Folder

```
utext/
├── index.html
├── package.json            # scripts: dev / build / preview
├── vite.config.js
├── .env.example            # template env (copy → .env)
├── src/
│   ├── main.js
│   ├── App.vue             # gate: LoginScreen <-> AppShell, mount ToastHost
│   ├── lib/
│   │   ├── supabase.js     # client init (url + anon key dari .env)
│   │   ├── crypto.js       # generateKeypair, encrypt/decrypt text+bytes (libsodium)
│   │   ├── chat.js         # SEMUA logic chat (lihat §4)
│   │   ├── auth.js         # login, identity, backup/restore, profile
│   │   └── driveBackup.js  # Google Drive backup/restore private key (GIS)
│   ├── stores/             # Pinia: ui, auth, conversations, prefs, toast
│   ├── components/
│   │   ├── atoms/          # Avatar, TextInput, BaseButton, Toggle, ToastHost,
│   │   │                   # ConfirmDialog, MediaViewer, CheckIcon, StatusDot, dll
│   │   ├── molecules/      # MessageBubble, ContextMenu, ChatListItem, UserListItem, dll
│   │   ├── organisms/      # AppHeader, Sidebar, ChatPanel, ChatHeader,
│   │   │                   # MessageList, Composer, SettingsSheet
│   │   ├── templates/      # AppShell.vue (OTAK aplikasi, lihat §5)
│   │   └── LoginScreen.vue
│   └── styles/ (jika ada)
└── supabase/
    ├── schema-phase-f.sql  # status, deleted_for[], deleted_for_all, soft_delete
    ├── schema-phase-g.sql  # reply_to, edited_at
    ├── schema-phase-h.sql  # RPC mark_read/mark_delivered/soft_delete_account, bucket avatars
    ├── schema-phase-i.sql  # relax search_users ke 1 char
    ├── schema-phase-j.sql  # fix delete_message_for_me (NULL bug)
    └── schema-phase-k.sql  # RPC: soft_delete_account, delete_conversation_for_all
    ├── schema-phase-l.sql  # soft_delete_account: null public_key, display 'Deleted Account'
    ├── schema-phase-m.sql  # reset_my_account: hapus membership lama + clear deleted_at
    └── schema-phase-n.sql  # setup_done flag + last_seen (online fallback) + RPC
```

---

## 3. Setup / First Run (untuk dev di PC)

```bash
# 1. clone
git clone https://github.com/mocriz/utext.git
cd utext

# 2. install
npm install

# 3. env
cp .env.example .env
# isi .env:
#   VITE_SUPABASE_URL=https://sgmiqkqigfmwgiajaqvo.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon key dari Supabase → Project Settings → API>
#   VITE_GOOGLE_CLIENT_ID=<client id Google OAuth>

# 4. JALANKAN SQL ke Supabase (wajib! lihat §6)
#    Buka Supabase → SQL Editor → jalankan urut: phase-f → g → h → i → j → k

# 5. dev
npm run dev        # http://localhost:5173
```

**Wajib:** tanpa jalanin SQL phase-f sampai k, fitur berikut GAGAL:
reply, edit, read receipt, soft-delete account, delete message, delete conversation, search 1-char.

---

## 4. `src/lib/chat.js` — Fungsi Utama

| Fungsi | Job |
|--------|-----|
| `startConversationWith(targetUserId)` | Buat conversation via RPC `create_conversation_with`. **Terima UUID string** (atau object `{id}`) |
| `findExistingConversation(targetUserId)` | Cek sudah ada conversation 1-on-1? |
| `listConversations()` | List conversation + partner (tanpa join berat) |
| `loadMessages(convId)` | Load + decrypt semua pesan. **Filter** `deleted_for_all` & `deleted_for[]` (pesan yg sudah dihapus tidak muncul) |
| `sendText(convId, partnerId, text, replyTo)` | Encrypt + insert |
| `editMessage(id, partnerId, text)` | Re-encrypt (max 10 menit, hanya pemilik) |
| `sendPhoto(convId, partnerId, file)` | Encrypt + upload bucket `media` |
| `getPhoto(convId, partnerId, path, iv)` | Download + decrypt → blob URL |
| `subscribeMessages(convId, onNew, onUpdate)` | Realtime INSERT + UPDATE (hapus-untuk-semua realtime) + fallback polling 3s kalau WS mati |
| `subscribeTyping(convId, myId, cb)` | Broadcast typing (ephemeral) |
| `subscribePresence(convId, myId, onSync)` | Presence online. Return `{ refresh, unsubscribe }`. Track `{userId, online_at}`, heartbeat 8s, auto re-subscribe kalau CLOSED |
| `deleteMessageForMe(id)` | RPC `delete_message_for_me` → append user ke `deleted_for[]` |
| `deleteMessageForAll(id, convId)` | Set `deleted_for_all=true` (hanya sender) |
| `deleteConversation(convId)` | Hapus membership sendiri ("untuk saya") |
| `deleteConversationForAll(convId)` | RPC `delete_conversation_for_all` → hapus messages + members + conversation ("untuk semua", lawan kehilangan) |
| `softDeleteAccount()` | RPC `soft_delete_account` → `profiles.deleted_at = now()`, display 'Deleted Account' |
| `markDelivered / markRead(convId)` | RPC receipt (dibungkus try/catch, silent) |
| `searchUsers(q)` | RPC `search_users` (min 1 char) |
| `uploadAvatar(file)` | Upload bucket `avatars` (public), return URL |

---

## 5. `AppShell.vue` — State & Handler (otak UI)

State penting:
- `room` (reactive): `{ messages, draft, typing, partnerOnline }`
- `activeConv`, `activePartner`: room aktif
- `replyingTo`, `editingMsg`: mode reply/edit
- `searching`, `searchQuery`, `searchResults`: search user
- `sidebarWidth` (260–700px, persist localStorage `utext_sidebar_w`)
- `viewerSrc`: media viewer modal
- `markedReadFor` (Set): cegah markRead berulang per room
- `seenMsgIds` (Set): cegah duplikat pesan realtime (fix spam)
- `lastSeen`: timestamp online partner (presence)

Handler:
- `onOpen(c)`: load messages, subscribe, mark delivered/read (SEKALI), setup typing/presence, **guard re-subscribe** (cegah leak + spam)
- `closeRoom()`: unsubscribe semua channel, revoke blob URLs, clear timers/sets
- `onSend()`: kirim / simpan edit
- `onBubbleMenu(m)`: context menu pesan — **pesan lawan hanya "Hapus untuk saya"**; pesan sendiri + "Hapus untuk semua"
- `onConvMenu(c)`: **"Hapus untuk saya" / "Hapus untuk semua"** (konfirmasi modal)
- `onCtxSelect(val)`: eksekusi pilihan menu (wrap toast sukses/error)
- `startChat(user)`: buka/buat conversation dari hasil search (extract UUID dari object user)
- `focusComposer()`: auto-focus field text (buka room, balas, edit, keyboard fisik)

---

## 6. Supabase SQL — Urutan Eksekusi WAJIB

Buka Supabase → SQL Editor → New query → paste isi file → Run. Urut:

1. **phase-f.sql** — kolom `status`, `deleted_for[]`, `deleted_for_all`, `profiles.deleted_at`, RPC `mark_read`/`mark_delivered`/`set_display_name`/`soft_delete_account`
2. **phase-g.sql** — `messages.reply_to`, `messages.edited_at`
3. **phase-h.sql** — RPC `delete_message_for_me`, bucket `avatars` + policy, grant execute
4. **phase-i.sql** — relax `search_users` ke min 1 char
5. **phase-j.sql** — fix `delete_message_for_me` (NULL-safe `array_append`)
6. **phase-k.sql** — RPC `soft_delete_account` (final), `delete_conversation_for_all`, grant execute

> Semua `create or replace function` idempotent — aman dijalankan ulang.
> Setelah phase-f: jangan lupa `alter publication supabase_realtime add table messages;`
> (dan `conversations`, `conversation_members` kalau perlu) biar Realtime jalan.

### RPC yang harus ada (cek kalau fitur error "is not a function")
- `create_conversation_with(target_user_id uuid)`
- `search_users(q text)`
- `mark_read(conversation uuid)`
- `mark_delivered(conversation uuid)`
- `set_display_name(p_name text)`
- `soft_delete_account()`
- `delete_message_for_me(msg_id uuid)`
- `delete_conversation_for_all(conv_id uuid)`

---

## 7. Environment Variables (`.env`)

```
VITE_SUPABASE_URL=https://sgmiqkqigfmwgiajaqvo.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GOOGLE_CLIENT_ID=<google client id>.apps.googleusercontent.com
```

Ambil dari Supabase → Project Settings → API. Google Client ID dari Google Cloud Console
(Web application, authorized origin `http://localhost:5173` + domain deploy, redirect URI
`https://sgmiqkqigfmwgiajaqvo.supabase.co/auth/v1/callback`).

**JANGAN commit `.env`** (sudah di .gitignore). `.env.example` boleh.

---

## 8. Fitur & Catatan Behavior

| Fitur | Catatan |
|-------|---------|
| **Spam echo** | Di-fix: `subscribeMessages` filter pesan sendiri (`sender_id === kita`), `seenMsgIds` cegah duplikat, `onOpen` guard re-subscribe |
| **Read receipt** | centang 1 abu=sent, 2 abu=delivered, 2 biru=read. `markRead` hanya SEKALI per room (pas partner view) |
| **Reply** | Quote muncul di bubble + di atas composer. Klik quote → scroll ke original. `loadMessages` return `reply_to` |
| **Edit** | Max 10 menit (`EDIT_WINDOW_MS`), hanya pesan sendiri, teks. Tanda "·edit" |
| **Delete pesan** | Lawan → hanya "untuk saya". Sendiri → + "untuk semua" (realtime via UPDATE event) |
| **Delete conversation** | "Untuk saya" = hapus membership. "Untuk semua" = hapus room+pesan+members (lawan kehilangan, update setelah reload) |
| **Online indicator** | Presence poll `refresh()` tiap 5s, threshold 30s, track `{userId, online_at}` |
| **Typing indicator** | Di ChatHeader (ganti online jadi "mengetik…" pas partner ngetik) |
| **Search** | Klik icon → AppHeader jadi input, Sidebar tampil user match (min 1 char) |
| **Avatar** | Cache Google CDN → dataURL (localStorage) biar ga kena 429. Fallback inisial kalau gagal |
| **Media viewer** | Klik foto → modal fullscreen, zoom scroll/pinch (0.5–8x), drag pan, Esc close |
| **Resize** | Divider antar sidebar & chat (desktop), range 350–700px, persist localStorage |
| **Toast** | Semua aksi (backup/restore/save/delete) → toast sukses/error di atas layar |
| **Confirm dialog** | Custom modal (bukan `confirm()` browser) untuk hapus-untuk-semua + hapus akun |

---

## 9. Deploy ke Vercel

1. Push ke GitHub (`main`).
2. Vercel → New Project → import repo `mocriz/utext`.
3. Build settings (auto-detect Vite):
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. Environment Variables di Vercel → tambah 3 var `.env` (§7).
5. Deploy. Setelah live, tambah domain Vercel ke Google OAuth authorized origin + Supabase auth redirect.

Static SPA, tidak butuh server. Supabase menangani semua backend.

---

## 10. Troubleshooting (quick)

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `soft_delete_account is not a function` | SQL phase-k belum jalan | Jalankan `supabase/schema-phase-k.sql` |
| `delete_message_for_me` gagal / pesan balik | SQL phase-j belum jalan | Jalankan `schema-phase-j.sql` |
| Reply/edit/receipt tidak jalan | SQL phase-f/g/h belum jalan | Jalankan urut f→g→h |
| Search minta 2 huruf | RPC `search_users` lama | Jalankan `schema-phase-i.sql` |
| Pesan dobel / spam | listener leak | Sudah di-fix di `subscribeMessages` + `onOpen` guard |
| Avatar `NS_BINDING_ABORTED` / 429 | Rate limit Google CDN | Sudah di-cache ke dataURL (Avatar.vue). Ignore noise `MaxListeners` (itu MetaMask ext) |
| Realtime tidak update | `supabase_realtime` publication belum include table | `alter publication supabase_realtime add table messages, conversations, conversation_members` |
| Online indicator balik offline | presence state tidak ke-refresh | Sudah di-fix (poll `refresh()` 5s) |
| Chat dari search tidak kebuka | `startConversationWith` dapat object, bukan UUID | Sudah di-fix (extract `.id`) |

---

## 11. Maintenance Rutin

- **Update dependency:** `npm update` lalu `npm run build` (cek error).
- **Backup DB:** Supabase → Database → Backups (free tier: PITR mungkin terbatas, manual dump via `supabase db dump`).
- **Private key user:** di-handler user lewat Drive backup. Tidak perlu intervensi server.
- **Log error:** browser console (F12). Abaikan `contentscript.js` / `MaxListeners` (MetaMask).
- **Rollback:** `git log` → `git checkout <commit>` atau `git revert`. Deploy ulang.

---

## 12. Keamanan & Limitasi

- E2EE end-to-end: Supabase hanya simpan ciphertext. Admin (kamu) TIDAK bisa baca isi chat.
- Private key di localStorage (same-device) + Drive backup. Siapa pun yg akses device/browser bisa baca chat.
- Free tier Supabase: 500MB DB, 1GB storage, 2 projek. Cukup untuk personal.
- Soft-delete: akun di-flag `deleted_at`, chat lama tetap bisa dibaca lawan (yang sudah pernah chat). Login Gmail sama → mulai dari nol (public_key di-null).
- Tidak ada rate-limit ketat di sisi app; andalkan Supabase anon key + RLS (pastikan RLS aktif di semua table).

---

## 13. Account Lifecycle (create / delete / restore)

### Create akun
1. Login Google OAuth → Supabase bikin `auth.users` (id = `auth.uid()`).
2. `ensureIdentity()` cek `profiles.public_key`:
   - **NULL** → user baru: generate keypair X25519, simpan `public_key`, generate `username` random (`user_xxx`), cache `private_key` localStorage. Status: `new` (minta backup Drive).
   - **ada** → user lama: pakai `public_key` profil, cari `private_key` localStorage. Ada → `ok`. Tidak → `need_restore` (tombol Restore dari Drive).

### Hapus akun (reset identitas)
`softDeleteAccount()` (RPC `soft_delete_account` + hapus backup):
- `profiles.deleted_at = now()`, `display_name = 'Deleted Account'`, `username = NULL`, `key_backed_up = false`, **`public_key = NULL`**.
- Hapus file backup di Drive (`deleteDriveBackup()`).
- Hapus `private_key` lokal (`clearKey()`).
- **Lawan:** yang SUDAH pernah chat tetap baca chat lama (public key kita sudah di-cache di client mereka). Yang belum pernah buka → chat lama tidak bisa decrypt (edge case). Lawan lihat nama kita = "Deleted Account".

### Daftar ulang (email sama)
- Supabase Google OAuth email sama → **`auth.uid()` SAMA** (bukan user baru).
- `ensureIdentity()` detect (`deleted_at` SET atau `public_key` NULL) → panggil RPC `reset_my_account()`:
  - **Hapus `conversation_members` kita** → tidak lihat chat lama lagi.
  - **Clear `deleted_at` + `display_name=''` + `username=NULL` + `public_key=NULL`**.
  - Generate keypair BARU → **mulai dari nol bersih** (chat kosong, nama kosong, username baru, TIDAK ada label "Deleted Account").
- Backup Drive sudah dihapus → tidak ke-restore ke profil lama.
- **Lawan:** tetap pegang membership + messages mereka → tetap baca chat lama. Pas kita daftar ulang, profil kita `deleted_at` cleared → lawan lihat kita sebagai akun baru (nama kosong), chat lama mereka tetap ada.

### Restore vs Mulai Baru
- **Restore dari Drive**: `restorePrivateKey()` → file ada → return key → set session + localStorage → `ok`. File hilang → `null` → status `new` (mulai baru).
- **Mulai Baru** (tombol fallback): `startFresh()` → `ensureIdentity()` → generate keypair baru (jalan karena `public_key` NULL).
- **Stuck prevention**: `restorePrivateKey()` return `null` (bukan throw) kalau backup hilang → tidak stuck.

### Catatan penting
- Jangan pertahankan `public_key` saat delete — kalau dipertahankan, `ensureIdentity` balik ke branch "user lama" → loop `need_restore` (bug). Null-kan agar daftar ulang = user baru otomatis.
- `restoreFromDrive()` return **privateKey** (bukan `true`).

---

## 13.5 Setup Screen, Read Receipt & Online Indicator

### Setup Screen (onboarding wajib)
- `SetupScreen.vue` muncul pas `status==='new'` && `!setup_done` (gate di `App.vue`, sebelum AppShell).
- **Username WAJIB** (live-check `isUsernameAvailable`), **Backup Drive WAJIB** (`backupToDrive`), **Display name BOLEH SKIP** (placeholder = nama Google), **Photo BOLEH SKIP** (placeholder = avatar Google).
- Selesai → `saveSetup()` → update username/display/avatar + RPC `mark_setup_done()` → `setupDone=true` → masuk AppShell.
- SQL phase-n: `profiles.setup_done` boolean.

### Read Receipt (local-first, no delay)
- Pas buka room: `markReadLocal()` langsung set semua pesan partner `receipt='read'` di client → **2 biru instant** (ga nunggu RPC).
- RPC `mark_read` jalan background (silent) → sync ke lawan (biar lawan liat kita read).
- `refreshReceipts` polling 3s → sync status pesan KITA dari lawan (sent→delivered→read).
- Pref `prefs.readReceipt` default true. Toggle Settings → disabled + toast "coming soon".

### Online Indicator (text-only + DB fallback)
- `ChatHeader` ROMBAK: **tanpa dot**, cuma tulisan "Online" / "Terakhir dilihat …" / "Baru saja".
- `setupPresence`: Presence realtime + **fallback `get_last_seen` dari DB** (RPC phase-n) + heartbeat `touch_last_seen` tiap 5s.
- Threshold: 30s (presence) / 60s (DB fallback).
- Pref `prefs.onlineIndicator` default true. Toggle Settings → disabled + toast "coming soon".

### Refresh state persist
- `activeConv` disimpan ke `localStorage` (`utext_active_conv`) pas buka room; `onMounted` restore otomatis (chat room ga ilang pas refresh). `closeRoom()` hapus key.

---

## 14. Kontak / Referensi

- Repo: https://github.com/mocriz/utext
- Supabase: https://sgmiqkqigfmwgiajaqvo.supabase.co
- Drive backup file: `utext-key.backup.json` (root Drive user)
- LocalStorage keys: `utext_private_key`, `utext_drive_token`, `utext_sidebar_w`, `utext_avatar_cache`, `utext_last_room` (obsolete)

---
*Docs generated untuk maintenance. Semua path relatif ke root repo `/home/rizki/utext` (Hermes) atau `D:\Dev\utext` (PC user).*
