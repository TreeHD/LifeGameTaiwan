// Core game state machine. Whole point of persisting this: if user refreshes
// mid-game (展覽 kiosk 斷電、手滑刷新、forgot which tab), they land back on the
// same screen with the same character / history. RELIVE counter persists too.
//
// Screens flow as a strict state machine — see `screen` getter logic:
//   idle → loading_character → character → dream → loading_node → node → … →
//     loading_ending → life_over → (relive)→ loading_node | (quit)→ idle

import { defineStore } from 'pinia'
import { useSettingsStore } from './settings.js'
import { fetchStats } from '../services/stats.js'
import { createLLM } from '../services/llm.js'
import { promptCharacter, promptNextNode, promptEnding } from '../services/prompts.js'
import { pickArchetype } from '../services/archetypes.js'

const RELIVE_LIMIT = 1

const initialState = () => ({
  character: null,
  archetype: null,         // randomly chosen at game start, fixed for the whole life
  currentNode: null,
  history: [],
  reliveRemaining: RELIVE_LIMIT,
  isOver: false,
  ending: null,
  stats: null,
  status: 'idle',
  error: null,
  generatingMessage: ''
})

export const useGameStore = defineStore('game', {
  state: initialState,
  persist: {
    paths: ['character', 'archetype', 'currentNode', 'history', 'reliveRemaining', 'isOver', 'ending', 'stats', 'status']
  },
  getters: {
    screen: (s) => {
      if (s.status === 'idle') return 'idle'
      if (s.status === 'loading_character') return 'loading'
      if (s.status === 'character_ready') return 'character'
      if (s.status === 'dream') return 'dream'
      if (s.status === 'loading_node' && s.history.length === 0 && !s.currentNode) return 'loading'
      if (s.isOver) return 'life_over'
      if (s.currentNode) return 'node'
      if (s.status === 'loading_ending') return 'loading'
      return 'idle'
    },
    canRelive: (s) => s.isOver && s.reliveRemaining > 0
  },
  actions: {
    _llm() {
      const settings = useSettingsStore()
      if (!settings.isConfigured) throw new Error('尚未設定 API Key — 請先到設定頁。')
      return createLLM(settings)
    },

    async startNewGame() {
      const settings = useSettingsStore()
      if (!settings.isConfigured) {
        this.error = '尚未設定 API Key — 請先到設定頁。'
        return
      }

      // Reset everything except the persisted settings
      Object.assign(this, initialState())
      this.archetype = pickArchetype()
      this.status = 'loading_character'
      this.generatingMessage = 'Generating character with AI...'

      try {
        this.stats = await fetchStats(settings.statsBaseUrl)
        const llm = this._llm()
        const { system, user } = promptCharacter(this.stats, this.archetype)
        const character = await llm.generateJSON(system, user)
        this.character = character
        this.status = 'character_ready'
      } catch (err) {
        this.error = `角色生成失敗：${err.message}`
        this.status = 'idle'
      } finally {
        this.generatingMessage = ''
      }
    },

    advanceToDream() {
      if (this.status === 'character_ready') this.status = 'dream'
    },

    async submitDream(dream) {
      if (!dream || !dream.trim()) return
      this.character.dream = dream.trim()
      await this._generateFirstNode()
    },

    async _generateFirstNode() {
      this.status = 'loading_node'
      this.generatingMessage = 'Generating future...'
      try {
        const llm = this._llm()
        const { system, user } = promptNextNode(this.character, [], this.stats, this.archetype)
        this.currentNode = await llm.generateJSON(system, user)
        this.status = 'node_ready'
      } catch (err) {
        this.error = `節點生成失敗：${err.message}`
        this.status = 'character_ready'
      } finally {
        this.generatingMessage = ''
      }
    },

    async makeChoice(choiceIndex) {
      if (!this.currentNode || this.isOver) return
      const node = this.currentNode
      const choice = node.choices[choiceIndex]
      if (!choice) return

      this.history.push({
        year: `民國${node.year}年`,
        age: String(node.age),
        node: node.title,
        situation: node.situation,
        choice: choice.label,
        choice_hint: choice.hint || '',
        choiceIndex,
        cast: node.cast || [],
        // state_after = the projected state for the branch the player picked.
        // This is what the next prompt's "目前狀態" block reads from, and is
        // why later nodes stop contradicting earlier ones.
        state_after: node.state_projections
          ? (choiceIndex === 0 ? node.state_projections.if_a : node.state_projections.if_b)
          : null,
        alternatives: node.choices.map((c, i) => ({ label: c.label, picked: i === choiceIndex }))
      })

      if (node.is_terminal) {
        await this._generateEnding()
        return
      }

      this.status = 'loading_node'
      this.generatingMessage = 'Generating future...'
      this.currentNode = null
      try {
        const llm = this._llm()
        const { system, user } = promptNextNode(this.character, this.history, this.stats, this.archetype)
        this.currentNode = await llm.generateJSON(system, user)
        this.status = 'node_ready'
      } catch (err) {
        this.error = `節點生成失敗：${err.message}`
        // Roll back the optimistic history push so user can retry
        this.history.pop()
        this.status = 'node_ready'
        this.currentNode = node
      } finally {
        this.generatingMessage = ''
      }
    },

    async _generateEnding() {
      this.status = 'loading_ending'
      this.generatingMessage = 'Writing your story...'
      this.currentNode = null
      try {
        const llm = this._llm()
        const { system, user } = promptEnding(this.character, this.history, this.archetype)
        this.ending = await llm.generateText(system, user)
        this.isOver = true
        this.status = 'over'
      } catch (err) {
        this.error = `結局生成失敗：${err.message}`
        this.status = 'node_ready'
      } finally {
        this.generatingMessage = ''
      }
    },

    async relive() {
      if (this.reliveRemaining <= 0) return
      this.reliveRemaining -= 1
      this.history = []
      this.isOver = false
      this.ending = null
      this.currentNode = null
      // archetype stays the same — relive walks a different path through the same life sample
      await this._generateFirstNode()
    },

    quit() {
      Object.assign(this, initialState())
    },

    clearError() {
      this.error = null
    }
  }
})
