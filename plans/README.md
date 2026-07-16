# Animation Improvement Plans — utext

Audit berdasarkan `emilkowalski/skills` (emil-design-eng, review-animations, improve-animations, find-animation-opportunities).

## Recon
- **Stack:** Vue 3 + Vite, scoped CSS (no animation lib). Plain CSS transitions/keyframes.
- **Motion lives in:** `src/components/atoms/*`, `organisms/*`, `templates/AppShell.vue`, `molecules/*`.
- **Personality:** 1-on-1 chat pribadi — crisp & calm, bukan playful. Jadi restraint > delight.
- **Frequency map:** toast/modal/sheet = occasional; button press = tens/day; typing dots = occasional; flash = rare (user-initiated jump).

## Findings (ordered by leverage = impact ÷ effort)

| # | Sev | Category | Location | Finding | Fix |
| --- | --- | --- | --- | --- | --- |
| 001 | HIGH | Feedback | BaseButton/IconButton/Login/ContextMenu | No `:active` scale → buttons feel dead | `:active { transform: scale(.97) }` + ease-out token |
| 002 | HIGH | Physicality | SettingsSheet/ConfirmDialog/MediaViewer | Modal mount tanpa `<Transition>` → teleport | Bungkus `<Transition>`, scale .96→1 + backdrop fade |
| 003 | HIGH | A11y/Perf | Global + ToastHost | No reduced-motion; `transition: all` | Global media query + explicit props |
| 004 | HIGH | Spatial | ToastHost | Toast di atas tapi enter dari bawah (+`all`/`ease`) | enter `translateY(-100%)` dari atas, simetris |
| 005 | MED | Cohesion | `:root` | No easing tokens; semua pakai `ease` lemah | `--ease-out`, `--ease-in-out`, `--ease-drawer` |
| 006 | MED | Easing/Dur | MessageList flash | 1.5s terlalu lama; `background` anim (bukan GPU) | 0.9s ease-out + box-shadow inset |
| 007 | LOW | Polish | Toggle/FAB | No easing token; FAB scale tanpa transition | ease-out + transform transition |

## Rejected (deliberate — KEEP as is)
- **Typing dots** (`TypingIndicator`, `ChatHeader tdot`): occasional, purpose=feedback, <300ms, opacity+scale → OK. Jangan dihapus.
- **Spinner** (`Spinner.vue`): `spin .7s linear` — linear benar untuk loader (skill: "linear reserve for spinners"). OK.
- **MediaViewer pan/zoom**: `transform` + `will-change`-like (transition .05s linear) — GPU, gesture-driven. OK.
- **Sidebar↔Chat mobile toggle**: ganti via `v-if` + history; bukan animasi. Boleh ditambah slide (future) tapi bukan bug.

## Execution order
1. 005 (tokens) — prasyarat plan lain.
2. 001 (buttons) — highest leverage, lowest risk.
3. 002 (modals) — feel-breaking, butuh `<Transition>`.
4. 004 (toast direction) — ikut 002/003.
5. 003 (reduced-motion) — global safety.
6. 006 (flash) — polish.
7. 007 (toggle/fab) — polish.

## Status
- [ ] 001 press-feedback-buttons.md
- [ ] 002 modal-transitions.md
- [ ] 003 reduced-motion.md
- [ ] 004 toast-enter-from-top.md
- [ ] 005 easing-tokens.md
- [ ] 006 flash-timing.md
- [ ] 007 toggle-fab-polish.md
