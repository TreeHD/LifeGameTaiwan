<script setup>
import { ref, computed } from 'vue'
import { useGameStore } from '../stores/game.js'
import BranchTree from './BranchTree.vue'

const game = useGameStore()
const choosing = ref(false)

const node = computed(() => game.currentNode)

const choose = async (i) => {
  if (choosing.value) return
  choosing.value = true
  try { await game.makeChoice(i) }
  finally { choosing.value = false }
}
</script>

<template>
  <main class="screen node">
    <header class="node-head">
      <span class="year">民國 {{ node.year }} 年</span>
      <span class="age dim">{{ node.age }} 歲</span>
    </header>

    <h2 class="node-title">{{ node.title }}</h2>

    <p class="situation">{{ node.situation }}</p>

    <ul class="choices">
      <li v-for="(c, i) in node.choices" :key="i">
        <button :disabled="choosing" @click="choose(i)">
          <span class="diamond">◆</span>
          <span class="label">{{ c.label }}</span>
        </button>
      </li>
    </ul>

    <details v-if="game.history.length > 0" class="trail">
      <summary>已走過的路（{{ game.history.length }}）</summary>
      <BranchTree :history="game.history" :current="node" :show-alternatives="false" />
    </details>
  </main>
</template>

<style scoped>
.node { gap: 1.2rem; padding-top: 4rem; }

.node-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.node-title {
  font-size: 1.6rem;
  margin: 0;
  letter-spacing: 0.05em;
}

.situation {
  font-size: 1.05rem;
  line-height: 2;
  border-left: 2px solid var(--line);
  padding-left: 1.2rem;
  margin: 0.5rem 0 1.5rem;
  white-space: pre-line;
}

.choices {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.choices button {
  width: 100%;
  text-align: left;
  display: flex;
  gap: 0.8rem;
  padding: 0.9em 1.2em;
  font-size: 1rem;
  letter-spacing: 0.03em;
  border-color: var(--line);
}

.diamond { color: var(--fg); }

.trail {
  margin-top: 2rem;
  font-size: 0.85rem;
  color: var(--dim);
}
.trail summary {
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.4rem 0;
}
</style>
