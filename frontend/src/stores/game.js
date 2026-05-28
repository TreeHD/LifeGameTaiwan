// Core game state machine. Whole point of persisting this: if user refreshes
// mid-game (展覽 kiosk 斷電、手滑刷新、forgot which tab), they land back on the
// same screen with the same character / history. RELIVE counter persists too.
//
// Screens flow as a strict state machine — see `screen` getter logic:
//   idle → dream (player types wish) → loading_character → character (review)
//     → loading_node → node → … → loading_ending → life_over
//     → (relive)→ loading_node | (quit)→ idle
//
// The dream is collected BEFORE character generation so it can seed both the
// archetype interpretation and the character's gender / personality.

import { defineStore } from 'pinia'
import { useSettingsStore } from './settings.js'
import { fetchStats } from '../services/stats.js'
import { createLLM } from '../services/llm.js'
import { promptCharacter, promptNextNode, promptEnding } from '../services/prompts.js'
import { pickArchetype } from '../services/archetypes.js'

const RELIVE_LIMIT = 3

const initialState = () => ({
  character: null,
  archetype: null,         // randomly chosen at game start, fixed for the whole life
  gender: null,            // pre-rolled 50/50 so LLM doesn't default to male
  pendingDream: '',        // collected on dream screen before character exists
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
    paths: ['character', 'archetype', 'gender', 'pendingDream', 'currentNode', 'history', 'reliveRemaining', 'isOver', 'ending', 'stats', 'status']
  },
  getters: {
    screen: (s) => {
      if (s.status === 'idle') return 'idle'
      if (s.status === 'dream') return 'dream'
      if (s.status === 'loading_character') return 'loading'
      if (s.status === 'character_ready') return 'character'
      if (s.status === 'loading_node') return 'loading'
      if (s.status === 'loading_ending') return 'loading'
      if (s.isOver) return 'life_over'
      if (s.currentNode) return 'node'
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

      // Reset everything except the persisted settings, then jump straight to
      // the dream screen. Character generation happens AFTER we have the dream.
      Object.assign(this, initialState())
      this.archetype = pickArchetype()
      this.gender = Math.random() < 0.5 ? 'female' : 'male'
      this.status = 'dream'

      // Stats fetch is cheap and idempotent — kick it off now so by the time
      // the player has typed their wish, we already have stats in hand.
      try {
        this.stats = await fetchStats(settings.statsBaseUrl)
      } catch (err) {
        // non-fatal; submitDream will retry
        console.warn('stats prefetch failed:', err)
      }
    },

    async submitDream(dream) {
      if (!dream || !dream.trim()) return
      const trimmed = dream.trim()
      this.pendingDream = trimmed

      const settings = useSettingsStore()
      this.status = 'loading_character'
      this.generatingMessage = 'Generating character with AI...'

      try {
        if (!this.stats) this.stats = await fetchStats(settings.statsBaseUrl)
        const llm = this._llm()
        const { system, user } = promptCharacter(this.stats, this.archetype, this.gender, trimmed)
        const character = await llm.generateJSON(system, user)
        character.dream = trimmed
        if (!character.gender) character.gender = this.gender
        this.character = character
        this.status = 'character_ready'
      } catch (err) {
        this.error = `角色生成失敗：${err.message}`
        this.status = 'dream'
      } finally {
        this.generatingMessage = ''
      }
    },

    advanceToFirstNode() {
      if (this.status === 'character_ready') this._generateFirstNode()
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

      this.history.push(this._buildHistoryEntry(node, choiceIndex))

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

    // Build a single history row from a generated node + the chosen index.
    // Stores the FULL original node alongside derived fields, so RELIVE can
    // fork at any past entry by flipping choiceIndex without re-asking the LLM
    // for that decision point's choices.
    _buildHistoryEntry(node, choiceIndex) {
      const choice = node.choices[choiceIndex]
      const projections = node.state_projections || null
      const stateAfter = projections
        ? (choiceIndex === 0 ? projections.if_a : projections.if_b)
        : null
      return {
        year: `民國${node.year}年`,
        age: String(node.age),
        node: node.title,
        situation: node.situation,
        choice: choice.label,
        choice_hint: choice.hint || '',
        choiceIndex,
        cast: node.cast || [],
        state_after: stateAfter,
        alternatives: node.choices.map((c, i) => ({ label: c.label, picked: i === choiceIndex })),
        // Snapshot of the original node so reliveFrom can re-fork without LLM.
        original_node: {
          year: node.year,
          age: node.age,
          title: node.title,
          situation: node.situation,
          choices: node.choices,
          state_projections: projections,
          cast: node.cast || [],
          is_terminal: node.is_terminal || false
        }
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

    // Branch-point rollback. Pick a past history index, throw away everything
    // from that point onwards, and re-walk the LLM-generated node at that
    // index by flipping to the other choice. The original_node snapshot stored
    // in each history entry means we don't have to re-ask the LLM to come up
    // with the same fork — only the *next* node onwards is freshly generated.
    async reliveFrom(historyIndex) {
      if (this.reliveRemaining <= 0) return
      if (historyIndex < 0 || historyIndex >= this.history.length) return
      const entry = this.history[historyIndex]
      if (!entry?.original_node) {
        this.error = '這個節點是舊版本存檔，沒有保留分歧資料，無法回到此處重來。'
        return
      }

      this.reliveRemaining -= 1
      this.isOver = false
      this.currentNode = null

      // Capture the abandoned tail BEFORE slicing so the tree can keep showing
      // it as a ghost branch. The fork diamond keeps a list because the player
      // could relive from the same point repeatedly.
      const original = entry.original_node
      const flippedIndex = entry.choiceIndex === 0 ? 1 : 0
      const abandonedTail = this.history.slice(historyIndex + 1)
      const abandoned = {
        from_choice_index: entry.choiceIndex,
        from_choice_label: entry.choice,
        entries: abandonedTail,
        ending: this.ending || null
      }

      const flippedEntry = this._buildHistoryEntry(original, flippedIndex)
      const priorAbandoned = entry.abandoned_branches || []
      flippedEntry.abandoned_branches = [...priorAbandoned, abandoned]

      this.history = this.history.slice(0, historyIndex)
      this.history.push(flippedEntry)
      this.ending = null

      if (original.is_terminal) {
        await this._generateEnding()
        return
      }

      this.status = 'loading_node'
      this.generatingMessage = 'Generating future...'
      try {
        const llm = this._llm()
        const { system, user } = promptNextNode(this.character, this.history, this.stats, this.archetype)
        this.currentNode = await llm.generateJSON(system, user)
        this.status = 'node_ready'
      } catch (err) {
        this.error = `節點生成失敗：${err.message}`
        // Roll the flipped entry back so the player isn't stuck mid-fork.
        this.history.pop()
        this.isOver = true
        this.status = 'over'
      } finally {
        this.generatingMessage = ''
      }
    },

    quit() {
      Object.assign(this, initialState())
    },

    clearError() {
      this.error = null
    }
  }
})
