// useGame2048.js — logika murni di-copy dari repo es-repo/vue-exps (createGame2048),
// di-wrap jadi composable Vue 3. Tidak pakai TweenLite (animasi pakai CSS transition).
import { reactive, ref, computed } from 'vue'

// --- logika inti (sama persis kayak repo, vanilla JS) ---
function createGame2048(size) {
  size = size || 4
  const size2 = size * size
  const board = Array.apply(null, { length: size }).map(() =>
    Array.apply(null, { length: size }).map(() => 0)
  )
  let score = 0

  function cellIsEmpty(c) { return board[c.y][c.x] == 0 }
  function cellsEqual(c1, c2) { return board[c1.y][c.x] == board[c2.y][c.x] }
  function canMoveChip(cf, ct) { return cellIsEmpty(ct) || cellsEqual(cf, ct) }

  function moveChip(cf, ct) {
    const tWasEmpty = cellIsEmpty(ct)
    const v = (board[ct.y][ct.x] += board[cf.y][cf.x])
    board[cf.y][cf.x] = 0
    return tWasEmpty ? 0 : v
  }
  function findRandomEmptyPos() {
    let r = Math.floor(Math.random() * size2)
    const c = {}
    for (let i = size2; i > 0; i--) {
      c.y = Math.floor(r / size)
      c.x = r % size
      if (cellIsEmpty(c)) return c
      r++
      if (r == size2) r = 0
    }
    return null
  }
  function rot0(c, x, y) { c.x = x; c.y = y }
  function rot90(c, x, y) { c.x = y; c.y = x }
  function rot180(c, x, y) { c.x = size - 1 - x; c.y = y }
  function rot270(c, x, y) { c.x = y; c.y = size - 1 - x }

  function move(rot) {
    const scoreInc = 0
    const moves = []
    const consolidations = []
    const c = {}
    const tc = {}
    for (let y = 0; y < size; y++) {
      let s = size
      for (let x = size - 2; x >= 0; x--) {
        rot(c, x, y)
        if (!cellIsEmpty(c)) {
          let tx = x
          while (tx + 1 < s) {
            rot(tc, tx + 1, y)
            if (!cellIsEmpty(tc)) {
              if (cellsEqual(c, tc)) { tx++; s = tx }
              break
            }
            tx++
          }
          if (x != tx) {
            rot(tc, tx, y)
            const v = moveChip(c, tc)
            moves.push({ from: { x: c.x, y: c.y }, to: { x: tc.x, y: tc.y } })
            if (v > 0) { consolidations.push({ x: tc.x, y: tc.y, value: v }); score += v }
          }
        }
      }
    }
    return { moved: moves.length > 0, scoreInc, moves, consolidations }
  }

  return {
    size,
    board,
    score: () => score,
    turn() {
      const chips = []
      const p = findRandomEmptyPos()
      if (p != null) {
        const rnd = Math.random()
        const v = rnd > 0.8 ? 4 : 2
        p.value = v
        board[p.y][p.x] = v
        chips.push(p)
      }
      return chips
    },
    right: () => move(rot0),
    down: () => move(rot90),
    left: () => move(rot180),
    up: () => move(rot270),
    canMove() {
      for (let c = { y: 0 }, cr = { y: 0 }, cb = { y: 1 }; c.y < size; c.y++, cr.y++, cb.y++) {
        for (c.x = 0, cr.x = 1, cb.x = 0; c.x < size; c.x++, cr.x++, cb.x++) {
          if (cellIsEmpty(c) || (cr.x < size && cellsEqual(c, cr)) || (cb.y < size && cellsEqual(c, cb))) return true
        }
      }
      return false
    },
  }
}

// --- composable Vue 3 ---
export function useGame2048(size = 4) {
  const game = createGame2048(size)
  const score = ref(0)
  // chips: list tile untuk dirender absolut. tiap: {id, x, y, value}
  let idSeq = 1
  const chips = reactive([])

  function syncFromBoard() {
    // rebuild chips dari board (posisi absolut x,y; value). id stabil per posisi.
    chips.length = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (game.board[y][x]) chips.push({ id: y * size + x, x, y, value: game.board[y][x] })
      }
    }
  }

  function init() {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) game.board[y][x] = 0
    score.value = 0
    game.turn(); game.turn()
    syncFromBoard()
  }

  function doMove(dir) {
    const res = game[dir]()
    if (res.moved) {
      score.value = game.score()
      game.turn()
      syncFromBoard()
    }
    return res.moved
  }

  const gameOver = computed(() => !game.canMove())

  return { score, chips, init, doMove, gameOver, size }
}
