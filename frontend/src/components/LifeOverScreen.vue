<script setup>
import { ref } from 'vue'
import { useGameStore } from '../stores/game.js'
import BranchTree from './BranchTree.vue'

const game = useGameStore()
const reliving = ref(false)

const onPickAlternative = async (index) => {
  if (reliving.value) return
  if (!game.canRelive) {
    game.error = 'RELIVE 次數已用完。'
    return
  }
  reliving.value = true
  try { await game.reliveFrom(index) }
  finally { reliving.value = false }
}

const onQuit = () => game.quit()
</script>

<template>
  <main class="screen life-over">
    <h1 class="banner">LIFE OVER</h1>

    <section class="ending">
      <p>{{ game.ending }}</p>
    </section>

    <section class="tree-wrap">
      <div class="tree-head">
        <span class="screen-title">人生分支樹</span>
        <span v-if="game.canRelive" class="tree-hint">
          點任一虛線分支 → 從那一刻改走另一條路
          ・剩 {{ game.reliveRemaining }} 次
        </span>
        <span v-else class="tree-hint dim">RELIVE 次數已用完</span>
      </div>
      <BranchTree
        :history="game.history"
        :show-alternatives="true"
        :on-pick-alternative="game.canRelive && !reliving ? onPickAlternative : null"
      />
    </section>

    <div class="actions">
      <button @click="onQuit">&gt; QUIT</button>
    </div>
  </main>
</template>

<style scoped>
.life-over {
  gap: 2rem;
  padding-top: 4rem;
  /* Override the global .screen 980px cap — the tree benefits from extra room. */
  max-width: 1400px;
  padding-left: 0.8rem;
  padding-right: 0.8rem;
}
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
.tree-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}
.tree-hint {
  font-size: 0.78rem;
  color: var(--dim);
  letter-spacing: 0.05em;
}
.tree-hint.dim { opacity: 0.6; }

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
