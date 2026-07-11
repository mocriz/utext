<template>
  <div class="typing">
    <span class="dot" /><span class="dot" /><span class="dot" />
    <span class="label">sedang mengetik…</span>
  </div>
</template>

<script setup></script>

<style scoped>
.typing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--bubble-them);
  color: var(--bubble-them-fg);
  padding: 10px 14px;
  border-radius: 12px;
  border-bottom-left-radius: 3px;
}
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--muted);
  animation: blink 1.2s infinite both;
}
.dot:nth-child(2) { animation-delay: .2s; }
.dot:nth-child(3) { animation-delay: .4s; }
.label { font-size: 12px; color: var(--muted); margin-left: 6px; font-style: italic; }
@keyframes blink { 0%, 60%, 100% { opacity: .3; } 30% { opacity: 1; } }
</style>
