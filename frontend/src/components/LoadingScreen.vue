<script setup>
import { useGameStore } from '../stores/game.js'
const game = useGameStore()
</script>

<template>
  <main class="screen loading">
    <div class="loading-text">
      {{ game.generatingMessage || 'Loading...' }}
    </div>
    <div v-if="game.stats?.sources" class="sources">
      <div class="sources-label">資料來源 / data sources</div>
      <ul>
        <li v-for="(s, i) in game.stats.sources" :key="i">{{ s }}</li>
      </ul>
    </div>
  </main>
</template>

<style scoped>
.loading {
  justify-content: center;
  align-items: flex-start;
  gap: 4rem;
}
.loading-text {
  font-size: 1.4rem;
  letter-spacing: 0.05em;
}
.loading-text::after {
  content: '';
  display: inline-block;
  width: 1em;
  animation: dots 1.2s steps(4, end) infinite;
  text-align: left;
}
@keyframes dots {
  0%   { content: ''; }
  25%  { content: '.'; }
  50%  { content: '..'; }
  75%  { content: '...'; }
  100% { content: ''; }
}
.sources {
  font-size: 0.85rem;
  color: var(--dim);
  max-width: 28em;
}
.sources-label {
  margin-bottom: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.sources ul { list-style: none; padding: 0; margin: 0; }
.sources li { padding: 0.2rem 0; }
.sources li::before { content: '> '; }
</style>
