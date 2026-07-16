# 003 — Global prefers-reduced-motion + buang transition:all

**Severity:** HIGH (accessibility: tidak ada penanganan reduced-motion; ToastHost pakai `transition: all` yang menganimasikan properti tak terduga)
**Category:** Accessibility / Performance
**Commit:** (stamp saat eksekusi)

## Findings

| # | Location | Today | Why |
| --- | --- | --- | --- |
| 1 | Global (semua file) | **Tidak ada** `@media (prefers-reduced-motion: reduce)` | Pengguna dengan vestibular disorder / preferensi sistem "reduce motion" tetap dapat semua animasi. Skill: wajib hormati, "gentler not zero". |
| 2 | `src/components/atoms/ToastHost.vue:29` | `.toast-enter-active, .toast-leave-active { transition: all .25s ease; }` | `transition: all` menganimasikan SEMUA properti (background, box-shadow, font) → off-GPU, jank. Harus explicit. |

## Plan (self-contained)

### Step 1 — Tambah global reduced-motion di file CSS global (mis. `src/assets/base.css` atau dalam `<style>` App.vue / index.css)
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  /* keep opacity cross-fades (gentler, not zero) — override di atas terlalu brutal?
     Lebih baik: biarkan opacity transition tapi drop transform. */
}
```
Versi "gentler" (rekomendasi skill):
```css
@media (prefers-reduced-motion: reduce) {
  .toast-enter-from, .toast-leave-to,
  .sheet-enter-from .sheet, .sheet-leave-to .sheet,
  .confirm-enter-from .confirm, .confirm-leave-to .confirm {
    transform: none !important;  /* drop movement, keep opacity fade */
  }
  .flash { animation: none !important; }
  .tdot, .dot { animation: none !important; opacity: .5 !important; }
}
```

### Step 2 — ToastHost: ganti `transition: all` → explicit
```css
.toast-enter-active, .toast-leave-active {
  transition: opacity 220ms var(--ease-out), transform 220ms var(--ease-out);
}
```
(bukan `all`, bukan `ease` built-in).

## Verification
- macOS: System Settings → Accessibility → Display → Reduce Motion = ON.
- Buka app → toast masih fade (opacity) tapi gak slide; modal gak scale; typing dots diam.
- ToastHost tidak lagi menganimasikan `background`/`box-shadow` saat enter.
