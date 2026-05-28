<script setup>
import { useGameStore } from '../stores/game.js'
const game = useGameStore()
const next = () => game.advanceToDream()
</script>

<template>
  <main class="screen character">
    <div class="screen-title">Here are the details of this person</div>

    <div class="card">
      <div class="silhouette">
        <!-- Pure-CSS pixel silhouette stand-in for the spec's pixel art.
             Generative pixel-portrait would be a nice-to-have later. -->
        <div class="pixel-figure" aria-hidden="true">
          <div class="head"></div>
          <div class="body"></div>
        </div>
      </div>
      <div class="meta">
        <div class="row">
          <span class="name">{{ game.character?.name }}</span>
          <span class="age">{{ game.character?.current_age }} yrs</span>
        </div>
        <div class="row dim">
          <span>{{ game.character?.current_status || game.character?.current_occupation }}</span>
          <span>{{ game.character?.birth_place }}</span>
        </div>
        <div class="row dim small">
          <span>{{ game.character?.education_path }}</span>
          <span>{{ game.character?.income_tier }}</span>
        </div>
      </div>
    </div>

    <p class="summary">{{ game.character?.summary || game.character?.family_background }}</p>

    <div class="actions">
      <button @click="next">&gt; NEXT</button>
    </div>
  </main>
</template>

<style scoped>
.character { gap: 1.5rem; padding-top: 4rem; }

.card {
  display: flex;
  gap: 2rem;
  align-items: center;
  border: 1px solid var(--line);
  padding: 1.5rem;
}

.silhouette {
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pixel-figure {
  width: 64px;
  height: 88px;
  position: relative;
}
.pixel-figure .head {
  width: 36px;
  height: 36px;
  background: var(--fg);
  margin: 0 auto;
  image-rendering: pixelated;
  /* faux pixelation via box-shadow stack */
  box-shadow:
    -4px 0 0 var(--fg),  4px 0 0 var(--fg),
    0 -4px 0 var(--fg),  0  4px 0 var(--fg);
}
.pixel-figure .body {
  width: 56px;
  height: 48px;
  background: var(--fg);
  margin: 6px auto 0;
  clip-path: polygon(20% 0, 80% 0, 100% 100%, 0 100%);
}

.meta { flex: 1; }
.row {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0;
}
.name { font-size: 1.4rem; letter-spacing: 0.1em; }
.age { font-size: 1.1rem; }
.small { font-size: 0.85rem; }

.summary {
  font-size: 0.95rem;
  line-height: 1.9;
  white-space: pre-line;
  border-left: 2px solid var(--line);
  padding-left: 1rem;
  margin: 0;
}

.actions { margin-top: 2rem; }
.actions button {
  letter-spacing: 0.3em;
  padding: 0.7em 2em;
}

@media (max-width: 600px) {
  .card { flex-direction: column; align-items: flex-start; }
}
</style>
