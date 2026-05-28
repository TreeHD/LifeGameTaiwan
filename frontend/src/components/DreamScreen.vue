<script setup>
import { ref, computed } from 'vue'
import { useGameStore } from '../stores/game.js'

const game = useGameStore()
const dream = ref('')
const submitting = ref(false)

const submit = async () => {
  if (!dream.value.trim() || submitting.value) return
  submitting.value = true
  try { await game.submitDream(dream.value) }
  finally { submitting.value = false }
}

const placeholder = computed(() => {
  const examples = [
    '想擁有自己的咖啡店',
    '有一天回到家鄉',
    '不要再被房租追著跑',
    '看孩子健康長大',
    '到日本住一年',
    '證明自己選的路沒有錯'
  ]
  return examples[Math.floor(Math.random() * examples.length)]
})
</script>

<template>
  <main class="screen dream">
    <p class="line">{{ game.character?.name }}心裡有一個夢想。</p>
    <p class="line">你來替他說出來。</p>

    <form @submit.prevent="submit" class="form">
      <span class="prompt">&gt;</span>
      <input
        v-model="dream"
        :placeholder="placeholder"
        :disabled="submitting"
        autofocus
        maxlength="40"
      />
    </form>

    <div class="hint dim">按 Enter 繼續</div>
  </main>
</template>

<style scoped>
.dream {
  justify-content: center;
  gap: 1.2rem;
  text-align: center;
  align-items: center;
}
.line {
  font-size: 1.15rem;
  letter-spacing: 0.05em;
  margin: 0;
}
.form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
  width: 100%;
  max-width: 560px;
}
.prompt {
  font-size: 1.4rem;
  color: var(--fg);
}
.form input {
  flex: 1;
  border: none;
  border-bottom: 1px solid var(--fg);
  padding: 0.6rem 0.2rem;
  font-size: 1.1rem;
  letter-spacing: 0.05em;
}
.form input:focus { outline: none; }
.hint { font-size: 0.85rem; }
</style>
