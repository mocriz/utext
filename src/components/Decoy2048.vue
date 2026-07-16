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

/* ============ 2048 GAME (mekanik es-repo: rotate + slide kiri) ============ */
const score = ref(0)
// board 2D 4x4, board[y][x]
const board = reactive(Array.from({ length: 4 }, () => [0, 0, 0, 0]))
const tiles = computed(() => board.flat())   // biar template tetap pakai index 0..15

function emptyCells() {
  const e = []
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!board[y][x]) e.push({ x, y })
  return e
}
function spawn() {
  const e = emptyCells()
  if (!e.length) return
  const { x, y } = e[Math.floor(Math.random() * e.length)]
  board[y][x] = Math.random() < 0.8 ? 2 : 4
}
function init() {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) board[y][x] = 0
  score.value = 0
  spawn(); spawn()
}

// rotate koordinat (sama kayak es-repo)
function rot0(c) { return c }
function rot90(c) { return { x: c.y, y: c.x } }            // down
function rot180(c) { return { x: 3 - c.x, y: c.y } }       // left
function rot270(c) { return { x: c.y, y: 3 - c.x } }       // up

// geser + merge ke arah "kiri" (x mengecil) pada board yang udah di-rotate
function move(rotFn) {
  if (showError.value || showPin.value) return
  let moved = false
  let scoreInc = 0
  // 1) rotate board ke orientasi "kiri"
  const rb = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const t = rotFn({ x, y })
    rb[t.y][t.x] = board[y][x]
  }
  // 2) slide tiap baris ke kiri + merge
  for (let y = 0; y < 4; y++) {
    const row = rb[y].filter((v) => v)
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i] === row[i + 1]) { row[i] *= 2; scoreInc += row[i]; row.splice(i + 1, 1) }
    }
    while (row.length < 4) row.push(0)
    for (let x = 0; x < 4; x++) if (rb[y][x] !== row[x]) moved = true
    rb[y] = row
  }
  if (!moved) return
  // 3) rotate balik ke posisi asli (inverse rotation)
  const inv = inverseRot(rotFn)
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const t = inv({ x, y })
    board[t.y][t.x] = rb[y][x]
  }
  score.value += scoreInc
  spawn()
}
// inverse rotation (biar tile balik ke posisi bener)
function inverseRot(fn) {
  if (fn === rot0) return rot0
  if (fn === rot90) return rot270
  if (fn === rot180) return rot180
  return rot90
}
function onKey(e) {
  const m = { ArrowUp: rot270, ArrowRight: rot0, ArrowDown: rot90, ArrowLeft: rot180 }
  if (e.key in m) { e.preventDefault(); move(m[e.key]) }
}
function computeSwipe(x, y) {
  const dx = x - swipeX, dy = y - swipeY
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return // terlalu kecil, abaikan
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? rot0 : rot180)
  else move(dy > 0 ? rot90 : rot270)
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
