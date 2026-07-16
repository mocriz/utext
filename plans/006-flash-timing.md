# 006 — MessageList flash: durasi + easing + property

**Severity:** MEDIUM (noticeably off: flash 1.5s terlalu lama untuk feedback jump; `background` transition bukan GPU; `ease` weak)
**Category:** Easing & duration / Performance
**Commit:** (stamp saat eksekusi)

## Findings

| # | Location | Today | Why |
| --- | --- | --- | --- |
| 1 | `src/components/organisms/MessageList.vue:96` | `:deep(.flash) { animation: flash 1.5s ease; }` | 1.5s terlalu lama untuk sekadar menandai bubble (skill: UI < 300ms untuk feedback; flash boleh agak lebih tapi 1.5s berlebih). |
| 2 | `src/components/organisms/MessageList.vue:97` | `@keyframes flash { 0%,100% { background: transparent } 20%,60% { background: color-mix(...) } }` | `background` bukan GPU property → repaint. Skill: animate `transform`/`opacity` only. Gunakan `box-shadow` inset atau `opacity` overlay. |

## Plan (self-contained)

Ganti:
```css
:deep(.flash) { animation: flash 1.5s ease; }
@keyframes flash {
  0%, 100% { background: transparent; }
  20%, 60% { background: color-mix(in srgb, var(--accent) 22%, transparent); }
}
```
menjadi:
```css
:deep(.flash) {
  animation: flash 0.9s var(--ease-out);
}
@keyframes flash {
  0%, 100% { box-shadow: inset 0 0 0 0 transparent; }
  30% { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent); }
}
```
Catatan: `box-shadow` inset masih memicu paint, tapi jauh lebih murah dari `background` color-mix full repaint dan lebih terlihat sebagai "highlight" daripada background samar. Alternatif `opacity` overlay butuh elemen tambahan → skip.

## Verification
- Klik quote reply → bubble asli flash highlight 0.9s (cepat, tidak mengganggu) lalu hilang.
- Tidak ada `background` animation (GPU-friendly).
