# utext — backendless E2EE chat

Vue 3 + Vite frontend, Supabase (Postgres + Auth + Realtime + Storage) sebagai BaaS.
Pesan & foto dienkripsi di browser (libsodium), Supabase hanya menyimpan ciphertext.

## Setup
1. Copy `.env.example` → `.env`, isi dari Supabase → Project Settings → API:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_CLIENT_ID` (Web application OAuth client, scope `drive.file`)
2. `npm install`
3. `npm run dev` (localhost)

## Struktur
- `src/lib/supabase.js` — Supabase client
- `src/lib/crypto.js` — E2EE (X25519 keypair, ECDH shared secret, AES-GCM via secretbox, seal/unseal private key)
- `src/lib/driveBackup.js` — backup/restore private key ke Google Drive (drive.file scope)

## Keamanan
- RLS di semua tabel: user hanya bisa baca/tulis chat di conversation miliknya.
- Private key tidak pernah keluar browser. Backup ke Drive di-SEAL dengan passphrase (argon2id + secretbox).
