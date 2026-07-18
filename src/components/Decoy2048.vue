<template>
  <div class="g2048">
    <div class="g2048__wrap">
      <header class="g2048__header">
        <div class="g2048__title">
          <h1>2048</h1>
          <p>Gabungkan tile untuk mencapai <strong>2048</strong>!</p>
        </div>

        <div class="g2048__scores">
          <div class="g2048__score-box">
            <span class="label">Score</span>
            <span class="value">{{ score }}</span>
          </div>
          <div class="g2048__score-box">
            <span class="label">Best</span>
            <span class="value">{{ best }}</span>
          </div>
        </div>
      </header>

      <div class="g2048__toolbar">
        <button class="g2048__btn" @click="undo" :disabled="!canUndo">
          <Icon icon="mdi:undo" width="18" height="18" />
          Undo
        </button>
        <button class="g2048__btn g2048__btn--primary" @click="resetGame">
          <Icon icon="mdi:refresh" width="18" height="18" />
          New Game
        </button>
      </div>

      <div
        class="g2048__board"
        ref="boardRef"
        tabindex="0"
        @keydown="onKeydown"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <!-- grid cell backgrounds -->
        <div class="g2048__grid">
          <div
            v-for="i in size * size"
            :key="'cell-' + i"
            class="g2048__cell"
          ></div>
        </div>

        <!-- tiles -->
        <div class="g2048__tiles">
          <transition-group name="tile">
            <div
              v-for="tile in tiles"
              :key="tile.id"
              class="g2048__tile-pos"
              :style="tileStyle(tile)"
            >
              <div
                class="g2048__tile"
                :class="[
                  'g2048__tile--' + Math.min(tile.value, 2048),
                  { 'g2048__tile--new': tile.isNew, 'g2048__tile--merged': tile.merged }
                ]"
              >
                {{ tile.value }}
              </div>
            </div>
          </transition-group>
        </div>

        <!-- overlay -->
        <transition name="fade">
          <div v-if="status !== 'playing'" class="g2048__overlay">
            <div class="g2048__overlay-card">
              <Icon
                :icon="status === 'won' ? 'mdi:trophy' : 'mdi:emoticon-sad-outline'"
                width="42"
                height="42"
              />
              <h2>{{ status === 'won' ? 'Kamu Menang!' : 'Game Over' }}</h2>
              <p v-if="status === 'won'">Kamu berhasil mencapai 2048 🎉</p>
              <p v-else>Tidak ada langkah tersisa.</p>
              <div class="g2048__overlay-actions">
                <button
                  v-if="status === 'won'"
                  class="g2048__btn g2048__btn--primary"
                  @click="keepPlaying"
                >
                  Lanjut Main
                </button>
                <button class="g2048__btn g2048__btn--primary" @click="resetGame">
                  Main Lagi
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <div class="g2048__hint">
        <Icon icon="mdi:gesture-swipe" width="16" height="16" />
        Gunakan tombol panah / WASD, atau swipe di layar sentuh.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Icon } from '@iconify/vue'

const size = 4
const STORAGE_BEST = 'g2048-best-score'

const boardRef = ref(null)
const tiles = ref([]) // { id, value, row, col, isNew, merged }
const score = ref(0)
const hasStorage = typeof window !== 'undefined' && !!window.localStorage
const best = ref(hasStorage ? Number(localStorage.getItem(STORAGE_BEST)) || 0 : 0)
const status = ref('playing') // 'playing' | 'won' | 'lost'
const wonAcknowledged = ref(false)

let idCounter = 1
const history = ref([]) // snapshot stack for undo
const canUndo = computed(() => history.value.length > 0)

/* ---------- grid helpers ---------- */

function emptyGrid() {
  return Array.from({ length: size }, () => Array(size).fill(null))
}

function gridFromTiles() {
  const grid = emptyGrid()
  for (const t of tiles.value) grid[t.row][t.col] = t
  return grid
}

function randomEmptyCell(grid) {
  const empties = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) empties.push([r, c])
    }
  }
  if (empties.length === 0) return null
  return empties[Math.floor(Math.random() * empties.length)]
}

function spawnTile(grid) {
  const cell = randomEmptyCell(grid)
  if (!cell) return null
  const [row, col] = cell
  const value = Math.random() < 0.9 ? 2 : 4
  const tile = { id: idCounter++, value, row, col, isNew: true, merged: false }
  tiles.value.push(tile)
  grid[row][col] = tile
  return tile
}

function cloneTilesForHistory() {
  return tiles.value.map((t) => ({ ...t }))
}

function pushHistory() {
  history.value.push({
    tiles: cloneTilesForHistory(),
    score: score.value,
  })
  if (history.value.length > 20) history.value.shift()
}

function undo() {
  if (!canUndo.value) return
  const prev = history.value.pop()
  tiles.value = prev.tiles.map((t) => ({ ...t, isNew: false, merged: false }))
  score.value = prev.score
  status.value = 'playing'
}

/* ---------- game lifecycle ---------- */

function resetGame() {
  tiles.value = []
  score.value = 0
  status.value = 'playing'
  wonAcknowledged.value = false
  history.value = []
  idCounter = 1

  const grid = emptyGrid()
  spawnTile(grid)
  spawnTile(grid)

  nextTick(() => boardRef.value && boardRef.value.focus())
}

function keepPlaying() {
  wonAcknowledged.value = true
  status.value = 'playing'
}

function saveBestIfNeeded() {
  if (score.value > best.value) {
    best.value = score.value
    if (hasStorage) localStorage.setItem(STORAGE_BEST, String(best.value))
  }
}

/* ---------- movement logic ---------- */

// Returns ordered list of [row, col] positions to traverse per direction,
// so we always process tiles farthest in the movement direction first.
function traversalOrder(dir) {
  const rows = [...Array(size).keys()]
  const cols = [...Array(size).keys()]
  if (dir === 'down') rows.reverse()
  if (dir === 'right') cols.reverse()
  const order = []
  for (const r of rows) for (const c of cols) order.push([r, c])
  return order
}

function vector(dir) {
  return {
    up: { dr: -1, dc: 0 },
    down: { dr: 1, dc: 0 },
    left: { dr: 0, dc: -1 },
    right: { dr: 0, dc: 1 },
  }[dir]
}

function inBounds(r, c) {
  return r >= 0 && r < size && c >= 0 && c < size
}

function move(dir) {
  if (status.value !== 'playing') return

  const grid = gridFromTiles()
  const { dr, dc } = vector(dir)
  const order = traversalOrder(dir)

  let moved = false
  let gained = 0

  // reset merge flags
  for (const t of tiles.value) {
    t.isNew = false
    t.merged = false
  }

  for (const [r, c] of order) {
    const tile = grid[r][c]
    if (!tile) continue

    let nr = r
    let nc = c

    while (true) {
      const tr = nr + dr
      const tc = nc + dc
      if (!inBounds(tr, tc)) break

      const target = grid[tr][tc]
      if (!target) {
        // move into empty space
        grid[nr][nc] = null
        nr = tr
        nc = tc
        grid[nr][nc] = tile
        moved = true
        continue
      }

      if (target.value === tile.value && !target.merged && target !== tile) {
        // merge
        grid[nr][nc] = null
        target.value *= 2
        target.merged = true
        gained += target.value
        // remove the moving tile, keep target
        tiles.value = tiles.value.filter((t) => t.id !== tile.id)
        moved = true
        nr = tr
        nc = tc
        tile.row = nr
        tile.col = nc
        break
      }

      break
    }

    tile.row = nr
    tile.col = nc
  }

  if (!moved) return

  pushHistory()
  score.value += gained
  saveBestIfNeeded()

  const newTile = spawnTile(grid)
  if (newTile) newTile.isNew = true

  checkWin()
  checkGameOver()
}

function checkWin() {
  if (wonAcknowledged.value) return
  if (tiles.value.some((t) => t.value >= 2048)) {
    status.value = 'won'
  }
}

function checkGameOver() {
  const grid = gridFromTiles()
  // any empty cell?
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) return
    }
  }
  // any adjacent equal values?
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r][c].value
      if (r + 1 < size && grid[r + 1][c].value === v) return
      if (c + 1 < size && grid[r][c + 1].value === v) return
    }
  }
  status.value = 'lost'
}

/* ---------- input handling ---------- */

const keyMap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}

function onKeydown(e) {
  const dir = keyMap[e.key]
  if (!dir) return
  e.preventDefault()
  move(dir)
}

let touchStartX = 0
let touchStartY = 0

function onTouchStart(e) {
  const t = e.changedTouches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
}

function onTouchEnd(e) {
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  const threshold = 24

  if (Math.max(absX, absY) < threshold) return

  if (absX > absY) {
    move(dx > 0 ? 'right' : 'left')
  } else {
    move(dy > 0 ? 'down' : 'up')
  }
}

function handleWindowKeydown(e) {
  // only handle globally if board isn't already focused (fallback)
  if (document.activeElement !== boardRef.value) {
    const dir = keyMap[e.key]
    if (dir) {
      e.preventDefault()
      move(dir)
    }
  }
}

onMounted(() => {
  resetGame()
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
})

/* ---------- styling helpers ---------- */

const GAP = 12 // px, must match CSS
const CELL = 88 // px, must match CSS

function tileStyle(tile) {
  return {
    transform: `translate(${tile.col * (CELL + GAP)}px, ${tile.row * (CELL + GAP)}px)`,
  }
}
</script>

<style scoped>
.g2048 {
  --bg: #faf8ef;
  --board-bg: #bbada0;
  --cell-bg: rgba(238, 228, 218, 0.35);
  --text-dark: #776e65;
  --text-light: #f9f6f2;
  --accent: #8f7a66;
  --accent-hover: #9f8b76;

  display: flex;
  justify-content: center;
  padding: 32px 16px;
  background: var(--bg);
  min-height: 100%;
  font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  color: var(--text-dark);
  box-sizing: border-box;
}

.g2048__wrap {
  width: 100%;
  max-width: 420px;
}

.g2048__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.g2048__title h1 {
  margin: 0;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: 1px;
}

.g2048__title p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-dark);
  opacity: 0.8;
}

.g2048__scores {
  display: flex;
  gap: 8px;
}

.g2048__score-box {
  background: var(--board-bg);
  border-radius: 8px;
  padding: 8px 14px;
  text-align: center;
  min-width: 64px;
  color: var(--text-light);
}

.g2048__score-box .label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

.g2048__score-box .value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
}

.g2048__toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.g2048__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: #eee4da;
  color: var(--text-dark);
  transition: background 0.15s ease, opacity 0.15s ease, transform 0.05s ease;
}

.g2048__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.g2048__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.g2048__btn--primary {
  background: var(--accent);
  color: var(--text-light);
}

.g2048__btn--primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.g2048__board {
  position: relative;
  background: var(--board-bg);
  border-radius: 10px;
  padding: 12px;
  outline: none;
  user-select: none;
  touch-action: none;
}

.g2048__grid {
  display: grid;
  grid-template-columns: repeat(4, 88px);
  grid-template-rows: repeat(4, 88px);
  gap: 12px;
}

.g2048__cell {
  background: var(--cell-bg);
  border-radius: 6px;
}

.g2048__tiles {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  bottom: 12px;
}

/* Wrapper ini yang dipindah-pindah posisinya (translate) via inline style.
   Dipisah dari .g2048__tile supaya animasi scale di bawah tidak bentrok
   dengan transform posisi (translate) — kalau digabung di satu elemen,
   transform: scale(...) di keyframe akan menimpa translate dan tile
   akan "lompat" ke pojok kiri-atas tiap kali spawn/merge. */
.g2048__tile-pos {
  position: absolute;
  top: 0;
  left: 0;
  width: 88px;
  height: 88px;
  transition: transform 0.12s ease-in-out;
  will-change: transform;
}

.g2048__tile {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
}

.g2048__tile--new {
  animation: tile-spawn 0.18s ease;
}

.g2048__tile--merged {
  animation: tile-pop 0.18s ease;
}

@keyframes tile-spawn {
  from { transform: scale(0); }
}

@keyframes tile-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.g2048__tile--2 { background: #eee4da; color: var(--text-dark); }
.g2048__tile--4 { background: #ede0c8; color: var(--text-dark); }
.g2048__tile--8 { background: #f2b179; color: var(--text-light); }
.g2048__tile--16 { background: #f59563; color: var(--text-light); }
.g2048__tile--32 { background: #f67c5f; color: var(--text-light); }
.g2048__tile--64 { background: #f65e3b; color: var(--text-light); }
.g2048__tile--128 { background: #edcf72; color: var(--text-light); font-size: 28px; }
.g2048__tile--256 { background: #edcc61; color: var(--text-light); font-size: 28px; }
.g2048__tile--512 { background: #edc850; color: var(--text-light); font-size: 28px; }
.g2048__tile--1024 { background: #edc53f; color: var(--text-light); font-size: 24px; }
.g2048__tile--2048 { background: #edc22e; color: var(--text-light); font-size: 24px; box-shadow: 0 0 20px 4px rgba(237, 194, 46, 0.6); }

.g2048__overlay {
  position: absolute;
  inset: 0;
  background: rgba(238, 228, 218, 0.75);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.g2048__overlay-card {
  text-align: center;
  color: var(--text-dark);
}

.g2048__overlay-card h2 {
  margin: 8px 0 4px;
  font-size: 26px;
}

.g2048__overlay-card p {
  margin: 0 0 14px;
  font-size: 14px;
  opacity: 0.85;
}

.g2048__overlay-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.g2048__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-dark);
  opacity: 0.7;
}

/* responsive: shrink board on very small screens */
@media (max-width: 380px) {
  .g2048__grid {
    grid-template-columns: repeat(4, 72px);
    grid-template-rows: repeat(4, 72px);
    gap: 10px;
  }
  .g2048__tile-pos {
    width: 72px;
    height: 72px;
  }
  .g2048__tile {
    font-size: 26px;
  }
}
</style>