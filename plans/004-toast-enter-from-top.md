# 004 — ToastHost: enter dari atas + ease-out + exit simetris

**Severity:** HIGH (feel-breaking: toast masuk dari bawah padahal posisinya di ATAS → spatial inconsistency; pakai `ease` weak + `transition: all`)
**Category:** Physicality / Spatial consistency
**Commit:** (stamp saat eksekusi)

## Findings

| # | Location | Today | Why |
| --- | --- | --- | --- |
| 1 | `src/components/atoms/ToastHost.vue:18` | `top: 18px` (di ATAS layar) | Posisi toast di atas. |
| 2 | `src/components/atoms/ToastHost.vue:30` | `.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }` | **Masuk dari bawah** (`+10px` = ke bawah) padahal di atas → "teleport" dari arah salah. Skill: "toast enters and exits from the same direction". Harus `translateY(-100%)` (dari atas). |
| 3 | `src/components/atoms/ToastHost.vue:29` | `transition: all .25s ease` | `all` + `ease` weak (lihat plan 003). |

## Plan (self-contained)

Ganti:
```css
.toast-enter-active, .toast-leave-active { transition: all .25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }
```
menjadi:
```css
.toast-enter-active, .toast-leave-active {
  transition: opacity 220ms var(--ease-out), transform 220ms var(--ease-out);
}
/* enter & exit SAMA arah: dari atas (translateY negatif) karena toast di top:18px */
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
```
Catatan: `translateY(-100%)` relatif terhadap tinggi toast sendiri → konsisten walau tinggi beda (skill: "Prefer percentages over hardcoded pixels").

## Verification
- Trigger toast (mis. klik "Salin") → muncul dari arah atas, slide ke posisi, fade in.
- Toast hilang (auto/click) → slide ke atas + fade out (sama path).
- Tidak ada `transition: all`.
