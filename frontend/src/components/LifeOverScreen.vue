<script setup>
import { useGameStore } from '../stores/game.js'
import BranchTree from './BranchTree.vue'

const game = useGameStore()

const onRelive = () => game.relive()
const onQuit   = () => game.quit()
</script>

<template>
  <main class="screen life-over">
    <h1 class="banner">LIFE OVER</h1>

    <section class="ending">
      <p>{{ game.ending }}</p>
    </section>

    <section class="tree-wrap">
      <div class="screen-title">人生分支樹</div>
      <BranchTree :history="game.history" :show-alternatives="true" />
    </section>

    <div class="actions">
      <button :disabled="!game.canRelive" @click="onRelive">
        RELIVE ({{ game.reliveRemaining }} times left)
      </button>
      <button @click="onQuit">&gt; QUIT</button>
    </div>
  </main>
</template>

<style scoped>
.life-over { gap: 2rem; padding-top: 4rem; }
.banner {
  font-size: clamp(2rem, 6vw, 3.2rem);
  letter-spacing: 0.5em;
  margin: 0;
  text-align: center;
}
.ending {
  border: 1px solid var(--line);
  padding: 1.6rem;
  font-size: 1.05rem;
  line-height: 2.1;
  white-space: pre-line;
}
.ending p { margin: 0; }

.tree-wrap {
  border-top: 1px solid var(--line);
  padding-top: 1.5rem;
}

.actions {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  margin-top: 1rem;
}
.actions button {
  letter-spacing: 0.2em;
  padding: 0.7em 1.6em;
}
</style>
