# 002 — Modal/Sheet/Dialog enter+exit transition (Settings, Confirm, Media)

**Severity:** HIGH (feel-breaking: elemen muncul "teleport" tanpa jembatan → terasa broken/ai-slop)
**Category:** Purpose & frequency / Physicality
**Commit:** (stamp saat eksekusi)

## Findings

| # | Location | Today | Why |
| --- | --- | --- | --- |
| 1 | `src/components/organisms/SettingsSheet.vue:3` | `<div v-if="open" class="sheet-backdrop">` — **mount tanpa `<Transition>`** | Sheet muncul instan (pop), backdrop + panel gak ada fade/scale. User kehilangan orientasi spasial. |
| 2 | `src/components/atoms/ConfirmDialog.vue:3` | `<div v-if="state.show" class="confirm-backdrop">` — tanpa `<Transition>` | Dialog konfirmasi (hapus akun!) muncul tiba-tiba. Aksi destruktif seharusnya punya feedback halus. |
| 3 | `src/components/atoms/MediaViewer.vue` | `<div class="mv-backdrop">` (selalu mount, `src` kosong = hidden via `v-if`?) — cek; jika tanpa enter transition | Zoom viewer muncul tanpa fade. |

## Plan (self-contained)

### Step 1 — SettingsSheet
Bungkus dengan `<Transition name="sheet">`:
```html
<teleport to="body">
  <Transition name="sheet">
    <div v-if="open" class="sheet-backdrop" @click="$emit('close')">
      <div class="sheet" @click.stop> ... </div>
    </div>
  </Transition>
</teleport>
```
Tambah CSS (modal = `transform-origin: center`, dikecualikan dari aturan origin-aware popover):
```css
.sheet-backdrop { /* existing */ }
.sheet-enter-active, .sheet-leave-active { transition: opacity 200ms var(--ease-out); }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform 220ms var(--ease-out), opacity 220ms var(--ease-out); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: scale(0.96); opacity: 0; }
```

### Step 2 — ConfirmDialog
Sama, bungkus `<Transition name="confirm">`:
```html
<teleport to="body">
  <Transition name="confirm">
    <div v-if="state.show" class="confirm-backdrop" @click="cancel"> ... </div>
  </Transition>
</teleport>
```
```css
.confirm-enter-active, .confirm-leave-active { transition: opacity 180ms var(--ease-out); }
.confirm-enter-active .confirm, .confirm-leave-active .confirm { transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out); }
.confirm-enter-from, .confirm-leave-to { opacity: 0; }
.confirm-enter-from .confirm, .confirm-leave-to .confirm { transform: scale(0.95); opacity: 0; }
```

### Step 3 — MediaViewer
Pastikan root dibungkus `<Transition name="mv">` (jika `viewerSrc` di AppShell di-reset kosong, ganti jadi `v-if="viewerSrc"` di dalam MediaViewer):
```html
<Transition name="mv">
  <div v-if="src" class="mv-backdrop" @click="close"> ... </div>
</Transition>
```
```css
.mv-enter-active, .mv-leave-active { transition: opacity 160ms var(--ease-out); }
.mv-enter-from, .mv-leave-to { opacity: 0; }
```

## Verification
- Buka Settings → backdrop fade-in 200ms, panel scale 0.96→1 (dari center, bukan dari trigger — benar untuk modal).
- Tutup → exit simetris (sama path, fade out).
- ConfirmDialog hapus akun → muncul halus, gak "jumped".
- MediaViewer → fade in/out.
- Cek `prefers-reduced-motion` (plan 003): semua jadi cross-fade opacity saja.
