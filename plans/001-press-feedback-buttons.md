# 001 — Press feedback + easing pada semua button

**Severity:** HIGH (feel-breaking: button terasa "mati" tanpa feedback press; skill wajibkan `:active` scale)
**Category:** Feedback / Physicality
**Commit:** (stamp saat eksekusi: `git rev-parse --short HEAD`)

## Findings (table)

| # | Location | Today | Why |
| --- | --- | --- | --- |
| 1 | `src/components/atoms/BaseButton.vue:35` | `transition: background .15s, opacity .15s;` — **tidak ada** `:active` scale | Button terasa tidak merespons saat ditekan. Skill: "Buttons must feel responsive — `:active { transform: scale(0.97) }`". |
| 2 | `src/components/atoms/IconButton.vue:34` | `transition: background .15s, color .15s;` — tidak ada `:active` | Sama dengan #1, untuk icon button (close, back, search). |
| 3 | `src/components/LoginScreen.vue:74` | `.google { transition: background .15s, border-color .15s; }` — tidak ada `:active` | Tombol utama login butuh feedback press. |
| 4 | `src/components/templates/AppShell.vue` ContextMenu items | tidak ada `:active` scale | Item menu (Salin, Balas, Hapus) butuh feedback. |
| 5 | Semua file di atas | `transition: ... .15s` tanpa easing eksplisit → default `ease` (weak) | Skill: "built-in CSS easings too weak; expect custom cubic-bezier". Gunakan `--ease-out`. |

## Plan (self-contained)

### Step 1 — Definisikan token easing di `:root` (lihat plan 005). Asumsi sudah ada:
```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}
```

### Step 2 — `src/components/atoms/BaseButton.vue`
Ganti:
```css
.btn { ... transition: background .15s, opacity .15s; }
```
menjadi:
```css
.btn {
  ...
  transition: background 140ms var(--ease-out), opacity 140ms var(--ease-out), transform 140ms var(--ease-out);
}
.btn:active:not(:disabled) { transform: scale(0.97); }
```
Tambahkan setelah `.btn:disabled { ... }`.

### Step 3 — `src/components/atoms/IconButton.vue`
Ganti `transition: background .15s, color .15s;` →
```css
transition: background 140ms var(--ease-out), color 140ms var(--ease-out), transform 140ms var(--ease-out);
```
Tambah:
```css
.icon-btn:active:not(:disabled) { transform: scale(0.94); }
```

### Step 4 — `src/components/LoginScreen.vue`
Ganti `.google { transition: background .15s, border-color .15s; }` →
```css
.google { transition: background 140ms var(--ease-out), border-color 140ms var(--ease-out), transform 140ms var(--ease-out); }
.google:active:not(:disabled) { transform: scale(0.98); }
```

### Step 5 — ContextMenu items (`src/components/.../ContextMenu.vue`)
Cari selector item (mis. `.item` / `button`), tambah:
```css
.item { transition: background 140ms var(--ease-out), transform 140ms var(--ease-out); }
.item:active { transform: scale(0.98); }
```

## Verification (feel-check)
- Tekan tombol di desktop (mouse down) → elemen mengecil 3% instan, balik saat lepas.
- Di mobile: tap tombol → ada feedback scale (bukan nunggu click).
- Transition terasa "nyambung" bukan lambat (ganti `ease` → `cubic-bezier(0.23,1,0.32,1)`).
