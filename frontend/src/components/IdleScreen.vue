<script setup>
import { useGameStore } from '../stores/game.js'
import { useSettingsStore } from '../stores/settings.js'

const game = useGameStore()
const settings = useSettingsStore()
const emit = defineEmits(['open-settings'])

const start = () => {
  if (!settings.isConfigured) {
    emit('open-settings', { guide: true })
    return
  }
  game.startNewGame()
}
</script>

<template>
  <main class="screen idle">
    <h1 class="title">台灣<br>人生模擬</h1>
    <p class="subtitle">Taiwan Life Game</p>
    <p class="lede">
      你即將替一個由 AI 生成的虛構台灣人做選擇，<br>
      從出社會走到退休。<br><br>
      他的人生會展開成一棵分支樹——<br>
      你走過的，與沒走的。
    </p>

    <div class="actions">
      <button @click="start">&gt; START</button>
    </div>

    <p class="footer dim">
      參考木原共《あなたをプレイするのはなに？》<br>
      森美術館 六本木クロッシング 2025
    </p>
  </main>
</template>

<script>
export default { emits: ['open-settings'] }
</script>

<style scoped>
.idle {
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 2rem;
}
.title {
  font-size: clamp(2.4rem, 8vw, 4.5rem);
  letter-spacing: 0.1em;
  margin: 0;
  line-height: 1.2;
}
.subtitle {
  margin: 0;
  letter-spacing: 0.3em;
  color: var(--dim);
}
.lede {
  margin-top: 2rem;
  font-size: 1rem;
  line-height: 1.9;
  color: var(--fg);
}
.actions { margin-top: 1rem; }
.actions button {
  font-size: 1.1rem;
  letter-spacing: 0.4em;
  padding: 0.8em 2em;
}
.footer {
  position: absolute;
  bottom: 2rem;
  font-size: 0.78rem;
  text-align: center;
  letter-spacing: 0.05em;
  line-height: 1.6;
}
</style>
