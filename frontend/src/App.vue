<script setup>
import { computed, ref } from 'vue'
import { useGameStore } from './stores/game.js'
import { useSettingsStore } from './stores/settings.js'
import LoadingScreen from './components/LoadingScreen.vue'
import CharacterScreen from './components/CharacterScreen.vue'
import DreamScreen from './components/DreamScreen.vue'
import NodeScreen from './components/NodeScreen.vue'
import LifeOverScreen from './components/LifeOverScreen.vue'
import IdleScreen from './components/IdleScreen.vue'
import SettingsScreen from './components/SettingsScreen.vue'

const game = useGameStore()
const settings = useSettingsStore()

const showSettings = ref(false)
const guideMode = ref(false)

const screen = computed(() => {
  if (showSettings.value) return 'settings'
  return game.screen
})

const closeSettings = () => {
  showSettings.value = false
  guideMode.value = false
}
const openSettings = (opts) => {
  showSettings.value = true
  guideMode.value = !!(opts && opts.guide)
}
</script>

<template>
  <div v-if="game.generatingMessage" class="generating-badge">{{ game.generatingMessage }}</div>

  <nav v-if="!settings.kioskMode || screen === 'idle'" class="top-nav">
    <a v-if="screen !== 'settings'" href="#" @click.prevent="openSettings()">[ settings ]</a>
    <a v-else href="#" @click.prevent="closeSettings">[ back ]</a>
  </nav>

  <SettingsScreen
    v-if="screen === 'settings'"
    :guide="guideMode"
    @close="closeSettings"
  />
  <IdleScreen v-else-if="screen === 'idle'" @open-settings="openSettings" />
  <LoadingScreen v-else-if="screen === 'loading'" />
  <CharacterScreen v-else-if="screen === 'character'" />
  <DreamScreen v-else-if="screen === 'dream'" />
  <NodeScreen v-else-if="screen === 'node'" />
  <LifeOverScreen v-else-if="screen === 'life_over'" />

  <div v-if="game.error" class="error-toast">
    {{ game.error }}
    <button @click="game.clearError()">×</button>
  </div>
</template>
