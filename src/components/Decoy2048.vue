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

    <!-- board: chips absolut-positioned (slide via CSS transition) -->
    <div
      class="board"
      ref="boardEl"
      @touchstart="onTouchStart"
      @touchend="onSwipe"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <div
        v-for="chip in chips"
        :key="chip.id"
        class="chip"
        :class="'v' + chip.value"
        :style="{ left: chipPct(chip.x), top: chipPct(chip.y) }"
      >{{ chip.value }}</div>
    </div>
    <p class="hint" v-if="!gameOver">Swipe / arrow keys to play</p>
    <p class="hint" v-else>Game over — refresh to retry</p>

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

    <!-- PIN screen (blank + numeric) -->
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
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useGame2048 } from '../lib/useGame2048'

const emit = defineEmits(['reveal'])
const { score, chips, init, doMove, gameOver, size } = useGame2048(4)

// chip position: (x / size) * 100% dengan gap. pakai calc biar ada padding.
function chipPct(i) {
  const gap = 2.5 // % antar cell (approx, match gap di CSS)
  const cell = 100 / size
  return `calc(${i * cell}% + ${gap}%)`
}

/* ============ INPUT ============ */
function onKey(e) {
  const m = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }
  if (e.key in m) { e.preventDefault(); doMove(m[e.key]) }
}
function computeSwipe(x, y) {
  const dx = x - swipeX, dy = y - swipeY
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return
  if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left')
  else doMove(dy > 0 ? 'down' : 'up')
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
let mSequence = []
let mTimer = null
let titleDownAt = 0
function onTitleDown() { titleDownAt = Date.now() }
function onTitleUp() {
  const dur = Date.now() - titleDownAt
  pushMorse(dur > 500 ? 'dash' : 'dot')
}
function onTitleLeave() { if (titleDownAt) onTitleUp() }
function pushMorse(sym) {
  if (showError.value || showPin.value) return
  mSequence.push(sym)
  if (mSequence.length > 3) mSequence.shift()
  clearTimeout(mTimer)
  mTimer = setTimeout(() => { mSequence = [] }, 1500)
  if (mSequence.length === 3 && mSequence[0] === 'dot' && mSequence[1] === 'dot' && mSequence[2] === 'dash') {
    showError.value = true
    mSequence = []
  }
}

/* ============ FAKE ERROR + SECRET ============ */
function onErrBoxClick() {}
function onRefresh() { showError.value = false; init() }
let secretDownAt = 0
function onSecretDown() { secretDownAt = Date.now() }
function onSecretUp() {
  if (Date.now() - secretDownAt >= 500) showPin.value = true
}

/* ============ PIN ============ */
const pin = ref('')
const pinInput = ref(null)
const CORRECT = (import.meta.env.VITE_DECOY_PIN || '1234').toString()
function onPinInput() {
  pin.value = pin.value.replace(/\D/g, '').slice(0, 4)
  if (pin.value.length === 4) {
    if (pin.value === CORRECT) emit('reveal')
    else pin.value = ''
  }
}
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
.decoy { max-width: 460px; margin: 0 auto; padding: 18px; min-height: 100dvh; background: honeydew; color: #2c3e50; font-family: 'Source Sans Pro', Arial, sans-serif; user-select: none; -webkit-user-select: none; touch-action: none; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.title { font-size: 52px; font-weight: 800; color: #35495e; cursor: pointer; margin: 0; letter-spacing: -2px; }
.score { background: #9aa4af; color: #fff; padding: 8px 16px; border-radius: 6px; font-weight: 700; text-align: center; }
.score small { display: block; font-size: 11px; opacity: .85; font-weight: 600; }

/* board: relatif, chips absolut di-dalam */
.board { position: relative; background: #35495e; padding: 2.5%; border-radius: 10px; aspect-ratio: 1; overflow: hidden; }
.chip {
  position: absolute; width: 21%; height: 21%;
  display: flex; align-items: center; justify-content: center;
  background: honeydew; border-radius: 7%; font-weight: 800; font-size: clamp(18px, 7vw, 34px);
  color: #2c3e50;
  transition: left .12s ease, top .12s ease;   /* slide halus antar cell */
  animation: chip-appear .18s ease;
}
.v2 { background: #eee4da; color: #776e65; } .v4 { background: #ede0c8; color: #776e65; }
.v8 { background: #f2b179; color: #fff; } .v16 { background: #f59563; color: #fff; } .v32 { background: #f67c5f; color: #fff; } .v64 { background: #f65e3b; color: #fff; }
.v128 { background: #edcf72; color: #fff; } .v256 { background: #edcc61; color: #fff; } .v512 { background: #edc850; color: #fff; } .v1024 { background: #edc53f; color: #fff; font-size: clamp(14px,5vw,26px); } .v2048 { background: #edc22e; color: #fff; font-size: clamp(13px,5vw,24px); }
.hint { text-align: center; opacity: .55; font-size: 13px; margin-top: 14px; }

@keyframes chip-appear { 0% { transform: scale(0); } 100% { transform: scale(1); } }

/* fake error overlay */
.errbox { position: fixed; inset: 0; background: rgba(20,20,20,.92); color: #e8e8e8; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 24px; z-index: 50; }
.errtxt { font-size: 15px; line-height: 1.6; text-align: center; max-width: 320px; }
.secret { color: #e8e8e8; }
.refresh { background: #35495e; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }

/* PIN screen */
.pinwrap { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; z-index: 60; }
.pininput { position: absolute; opacity: 0; }
.dots { display: flex; gap: 14px; }
.dots span { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #555; }
.dots span.on { background: #fff; border-color: #fff; }
</style>
