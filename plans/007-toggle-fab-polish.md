# 007 — Polish: Toggle easing + FAB transform transition

**Severity:** LOW (polish)
**Category:** Cohesion
**Commit:** (stamp saat eksekusi)

## Findings
- `src/components/atoms/Toggle.vue:21` knob `transition: left .15s` (no easing token) — pakai `var(--ease-out)`.
- `src/components/templates/AppShell.vue:693` `.search-fab:active { transform: scale(.94); }` tapi `.search-fab` tidak punya `transition: transform` → scale langsung (tidak halus).

## Plan
Toggle: `transition: left 160ms var(--ease-out);` + tambah `.knob:active { transform: scale(0.9); }` (subtle press).
FAB: tambah ke `.search-fab { transition: transform 140ms var(--ease-out), background 140ms var(--ease-out); }`.

## Verification
- Toggle slide halus dengan easing. FAB mengecil halus saat ditekan.
