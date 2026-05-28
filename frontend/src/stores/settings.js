// User-facing settings. Stored in localStorage so user only enters API keys once.
// Keys live here on purpose — they're already client-side anyway (LLM calls
// run from the browser); see README caveat about exposure.
//
// Per-provider keys: switching provider does NOT wipe the others. Each
// provider gets its own slot, and `currentApiKey` resolves to the right one.
// Legacy `apiKey` (from before this split) is migrated on first load below.
//
// `selfhost` provider has no client-side key — the Worker proxies to a shared
// upstream using server-side keys with round-robin rotation.

import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    provider: 'selfhost',              // 'selfhost' | 'gemini' | 'claude' | 'openai'

    // Per-provider keys. None of these are wiped when switching provider.
    geminiApiKey: '',
    claudeApiKey: '',
    openaiApiKey: '',

    geminiModel: 'gemini-3.1-flash-lite',
    claudeModel: 'claude-haiku-4-5',
    openaiModel: 'gpt-4o-mini',

    // OpenAI-compatible endpoint. Default is OpenAI itself, but any provider
    // exposing the /v1/chat/completions shape works (Groq, OpenRouter,
    // DeepSeek, Together, local Ollama / LM Studio, etc).
    openaiBaseUrl: 'https://api.openai.com/v1',

    // Selfhost endpoint — same-origin /api by default. Worker handles the
    // upstream keys + round-robin internally.
    selfhostBaseUrl: '/api',

    statsBaseUrl: '/api',
    kioskMode: false,

    // ── Legacy field. Kept around (and persisted) for one purpose only:
    // migrating users who saved a key before the per-provider split. The
    // hydration hook below copies it into the matching provider slot once,
    // then leaves it empty. Do NOT read this directly elsewhere — use
    // `currentApiKey` getter.
    apiKey: ''
  }),
  persist: {
    paths: [
      'provider',
      'geminiApiKey', 'claudeApiKey', 'openaiApiKey',
      'geminiModel', 'claudeModel', 'openaiModel',
      'openaiBaseUrl', 'selfhostBaseUrl',
      'statsBaseUrl', 'kioskMode',
      'apiKey'  // persisted only so the migration step can find it on first load
    ],
    afterRestore: (ctx) => {
      const s = ctx.store
      // One-time migration: if the legacy `apiKey` is set and the matching
      // per-provider slot is empty, copy it across, then clear the legacy
      // field. Idempotent — re-running this is a no-op.
      if (s.apiKey && s.apiKey.trim()) {
        const slot = providerKeyField(s.provider)
        if (slot && !s[slot]) s[slot] = s.apiKey
        s.apiKey = ''
      }
    }
  },
  getters: {
    // Active key for the currently selected provider. game.js / llm.js read
    // this — never the per-provider fields directly.
    currentApiKey: (s) => {
      if (s.provider === 'gemini') return s.geminiApiKey || ''
      if (s.provider === 'claude') return s.claudeApiKey || ''
      if (s.provider === 'openai') return s.openaiApiKey || ''
      return ''
    },
    // Selfhost has no client-side key — it's "configured" as long as the
    // worker endpoint exists. We optimistically say yes; createLLM will fail
    // gracefully if the proxy returns 503 (no upstream keys configured).
    isConfigured() {
      if (this.provider === 'selfhost') return true
      return this.currentApiKey.trim().length > 0
    },
    activeModel: (s) => {
      if (s.provider === 'gemini') return s.geminiModel
      if (s.provider === 'claude') return s.claudeModel
      if (s.provider === 'openai') return s.openaiModel
      if (s.provider === 'selfhost') return '(伺服器端控制)'
      return ''
    }
  },
  actions: {
    setCurrentApiKey(value) {
      const slot = providerKeyField(this.provider)
      if (slot) this[slot] = (value || '').trim()
    },
    reset() {
      this.provider = 'selfhost'
      this.geminiApiKey = ''
      this.claudeApiKey = ''
      this.openaiApiKey = ''
      this.geminiModel = 'gemini-3.1-flash-lite'
      this.claudeModel = 'claude-haiku-4-5'
      this.openaiModel = 'gpt-4o-mini'
      this.openaiBaseUrl = 'https://api.openai.com/v1'
      this.selfhostBaseUrl = '/api'
      this.statsBaseUrl = '/api'
      this.kioskMode = false
      this.apiKey = ''
    }
  }
})

function providerKeyField(provider) {
  if (provider === 'gemini') return 'geminiApiKey'
  if (provider === 'claude') return 'claudeApiKey'
  if (provider === 'openai') return 'openaiApiKey'
  return null
}
