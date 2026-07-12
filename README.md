# utext

Chat E2EE 1-on-1 — backendless (Supabase), static SPA (Vue 3 + Vite).

Fitur: E2EE X25519, Google OAuth, read receipt, reply, edit, delete (for me/all),
typing + online indicator, search user, media encrypt, avatar cache, media viewer
(zoom/pinch), resize sidebar, toast + confirm dialog.

## Quick start
```bash
npm install
cp .env.example .env   # isi SUPABASE_URL, ANON_KEY, GOOGLE_CLIENT_ID
# Jalankan SQL di supabase/ urut: phase-f → g → h → i → j → k
npm run dev
```

## Docs
Lihat **`DOCS.md`** untuk panduan maintenance lengkap (arsitektur, SQL, troubleshooting, deploy Vercel).

## Deploy
Vercel: build `npm run build`, output `dist`, env dari `.env`.

Repo: https://github.com/mocriz/utext
