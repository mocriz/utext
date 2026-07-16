<template>
  <div class="decoy">
    <header class="topbar">
      <h1
        class="title"
        @pointerdown="onTitleDown"
        @pointerup="onTitleUp"
        @pointerleave="onTitleLeave"
      >2048</h1>
      <div class="score"><small>SCORE</small>{{ score }}</div>
    </header>

    <!-- grid -->
    <div
      class="board"
      ref="boardEl"
      @touchstart="onTouchStart"
      @touchend="onSwipe"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <div v-for="n in 16" :key="n" class="cell">
        <span v-if="tiles[n - 1]" class="tile" :class="'v' + tiles[n - 1]">{{ tiles[n - 1] }}</span>
      </div>
    </div>
    <p class="hint">Swipe / arrow keys to play</p>

    <!-- fake UI error (muncul setelah Morse ..-) -->
    <div v-if="showError" class="errbox" @click="onErrBoxClick">
      <p class="errtxt">
        View state error: locale resource missing. Run
        <span
          class="secret"
          @pointerdown.stop="onSecretDown"
          @pointerup.stop="onSecretUp"
        >reset</span>
        to reinitialize, or Refresh.
      </p>
      <button class="refresh" @click.stop="onRefresh">Refresh</button>
    </div>

    <!-- PIN screen: blank + numeric -->
    <div v-if="showPin" class="pinwrap">
      <input
        ref="pinInput"
        v-model="pin"
        class="pininput"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="4"
        @input="onPinInput"
      />
      <div class="dots">
        <span v-for="i in 4" :key="i" :class="{ on: pin.length >= i }"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

const emit = defineEmits(['reveal'])

/* ============ 2048 GAME ============ */
const score = ref(0)
const tiles = reactive(new Array(16).fill(0))
let busy = false

function spawn() {
  const empty = []
  for (let i = 0; i < 16; i++) if (!tiles[i]) empty.push(i)
  if (!empty.length) return
  const i = empty[Math.floor(Math.random() * empty.length)]
  tiles[i] = Math.random() < 0.9 ? 2 : 4
}
function init() {
  for (let i = 0; i < 16; i++) tiles[i] = 0
  score.value = 0
  spawn(); spawn()
}
function slide(row) {
  let arr = row.filter((x) => x)
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) { arr[i] *= 2; score.value += arr[i]; arr.splice(i + 1, 1) }
  }
  while (arr.length < 4) arr.push(0)
  return arr
}
function rotate() {
  const n = []
  for (let c = 0; c < 4; c++) for (let r = 3; r >= 0; r--) n.push(tiles[r * 4 + c])
  for (let i = 0; i < 16; i++) tiles[i] = n[i]
}
function move(dir) {
  if (busy || showError.value || showPin.value) return
  const before = tiles.join(',')
  for (let i = 0; i < dir; i++) rotate()
  for (let r = 0; r < 4; r++) {
    const row = [tiles[r * 4], tiles[r * 4 + 1], tiles[r * 4 + 2], tiles[r * 4 + 3]]
    const out = slide(row)
    for (let c = 0; c < 4; c++) tiles[r * 4 + c] = out[c]
  }
  for (let i = 0; i < (4 - dir) % 4; i++) rotate()
  if (tiles.join(',') !== before) spawn()
}
function onKey(e) {
  const m = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }
  if (e.key in m) { e.preventDefault(); move(m[e.key]) }
}
function computeSwipe(x, y) {
  const dx = x - swipeX, dy = y - swipeY
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return // terlalu kecil, abaikan
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : 3)
  else move(dy > 0 ? 2 : 0)
}
function onSwipe(e) {
  const t = e.changedTouches ? e.changedTouches[0] : e
  computeSwipe(t.clientX, t.clientY)
}
function onTouchStart(e) { const t = e.changedTouches[0]; swipeX = t.clientX; swipeY = t.clientY }
let mouseDown = false
function onMouseDown(e) { mouseDown = true; swipeX = e.clientX; swipeY = e.clientY }
function onMouseUp(e) {
  if (!mouseDown) return
  mouseDown = false
  computeSwipe(e.clientX, e.clientY)
}
let swipeX = 0, swipeY = 0

/* ============ MORSE TRIGGER (..- = U) ============ */
const showError = ref(false)
const showPin = ref(false)
let mSequence = []            // 'dot' | 'dash'
let mTimer = null
let titleDownAt = 0
function onTitleDown() { titleDownAt = Date.now() }
function onTitleUp() {
  const dur = Date.now() - titleDownAt
  const sym = dur > 500 ? 'dash' : 'dot'
  pushMorse(sym)
}
function onTitleLeave() { if (titleDownAt) { onTitleUp() } }
function pushMorse(sym) {
  if (showError.value || showPin.value) return
  mSequence.push(sym)
  if (mSequence.length > 3) mSequence.shift()
  clearTimeout(mTimer)
  mTimer = setTimeout(() => { mSequence = [] }, 1500) // reset kalau kelamaan
  // cek ..- (dot dot dash)
  if (mSequence.length === 3 && mSequence[0] === 'dot' && mSequence[1] === 'dot' && mSequence[2] === 'dash') {
    showError.value = true
    mSequence = []
  }
}

/* ============ FAKE ERROR + SECRET WORD ============ */
function onErrBoxClick() { /* klik biasa di box = no-op (orang awam refresh) */ }
function onRefresh() { showError.value = false; init() }  // balik ke game
let secretDownAt = 0
function onSecretDown() { secretDownAt = Date.now() }
function onSecretUp() {
  const dur = Date.now() - secretDownAt
  if (dur >= 500) showPin.value = true   // long-press kata "reset" -> PIN
}

/* ============ PIN SCREEN ============ */
const pin = ref('')
const pinInput = ref(null)
const CORRECT = (import.meta.env.VITE_DECOY_PIN || '1234').toString()
function onPinInput() {
  pin.value = pin.value.replace(/\D/g, '').slice(0, 4)
  if (pin.value.length === 4) {
    if (pin.value === CORRECT) emit('reveal')
    else { pin.value = '' }  // salah -> reset (blank again)
  }
}
// fokus input pas PIN screen muncul (biar keyboard langsung nyala)
watch(showPin, (v) => { if (v) nextTick(() => pinInput.value?.focus()) })

onMounted(() => {
  init()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.decoy { max-width: 460px; margin: 0 auto; padding: 18px; min-height: 100dvh; background: honeydew; color: #2c3e50; font-family: 'Source Sans Pro', Arial, sans-serif; user-select: none; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.title { font-size: 52px; font-weight: 800; color: #35495e; cursor: pointer; margin: 0; letter-spacing: -2px; }
.score { background: #9aa4af; color: #fff; padding: 8px 16px; border-radius: 6px; font-weight: 700; text-align: center; }
.score small { display: block; font-size: 11px; opacity: .85; font-weight: 600; }
.board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #35495e; padding: 12px; border-radius: 10px; aspect-ratio: 1; }
.cell { background: #41b883; border-radius: 7%; display: flex; align-items: center; justify-content: center; }
.tile { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: honeydew; border-radius: 7%; font-weight: 800; font-size: 30px; color: #2c3e50; animation: chip-appear .18s ease; }
.v2 { background: #eee4da; color: #776e65; } .v4 { background: #ede0c8; color: #776e65; }
.v8 { background: #f2b179; color: #fff; } .v16 { background: #f59563; color: #fff; } .v32 { background: #f67c5f; color: #fff; } .v64 { background: #f65e3b; color: #fff; }
.v128 { background: #edcf72; color: #fff; } .v256 { background: #edcc61; color: #fff; } .v512 { background: #edc850; color: #fff; } .v1024 { background: #edc53f; color: #fff; font-size: 24px; } .v2048 { background: #edc22e; color: #fff; font-size: 22px; }
.hint { text-align: center; opacity: .55; font-size: 13px; margin-top: 14px; }

@keyframes chip-appear { 0% { transform: scale(0); } 100% { transform: scale(1); } }

/* fake error overlay */
.errbox { position: fixed; inset: 0; background: rgba(20,20,20,.92); color: #e8e8e8; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 24px; z-index: 50; }
.errtxt { font-size: 15px; line-height: 1.6; text-align: center; max-width: 320px; }
.secret { color: #e8e8e8; }
.refresh { background: #35495e; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }

/* PIN screen: blank + numeric */
.pinwrap { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; z-index: 60; }
.pininput { position: absolute; opacity: 0; }
.dots { display: flex; gap: 14px; }
.dots span { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #555; }
.dots span.on { background: #fff; border-color: #fff; }
</style>
