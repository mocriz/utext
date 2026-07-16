# 005 — Definisikan easing tokens di :root

**Severity:** MEDIUM (cohesion: setiap animasi pakai built-in `ease`/`ease-in-out` yang lemah; skill minta custom cubic-bezier konsisten)
**Category:** Cohesion & tokens
**Commit:** (stamp saat eksekusi)

## Findings
Seluruh codebase pakai `transition: ... .15s` / `.25s ease` tanpa token. Tidak ada `--ease-*` di `:root`.
Skill: "The built-in CSS easings are too weak. They lack the punch that makes animations feel intentional." + "plans must extend these, not invent parallel ones."

## Plan (self-contained)

Temukan file CSS global (cek `src/assets/*.css`, `src/App.vue <style>`, atau `index.css` yang di-import `main.js`). Tambahkan di `:root`:
```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* strong ease-out: UI enter/exit, press */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement A→B */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* iOS-like drawer/sheet */
}
```
Lalu di semua plan (001, 002, 003, 004, 006) ganti `ease` / `ease-in-out` → `var(--ease-out)` / `var(--ease-in-out)`.

Catatan: jangan buat duplikat token di tiap komponen — semua ambil dari `:root`.

## Verification
- Grep `transition:` di src → tidak ada lagi `ease` murni tanpa `var(--ease-*)`.
- Feel: transisi terasa "punchy" (cepat di awal) bukan lambat.
