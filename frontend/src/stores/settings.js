// User-facing settings. Stored in localStorage so user only enters API key once.
// `apiKey` lives here on purpose — it's already client-side anyway (LLM calls
// run from the browser); see README caveat about exposure.

import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    provider: 'gemini',                // 'gemini' | 'claude'
    apiKey: '',
    geminiModel: 'gemini-3.1-flash-lite',
    claudeModel: 'claude-haiku-4-5',
    statsBaseUrl: '/api',              // '' to skip backend and use static fallback
    kioskMode: false                   // hide settings link, fullscreen-friendly
  }),
  persist: { paths: ['provider', 'apiKey', 'geminiModel', 'claudeModel', 'statsBaseUrl', 'kioskMode'] },
  getters: {
    isConfigured: (s) => s.apiKey.trim().length > 0,
    activeModel: (s) => s.provider === 'gemini' ? s.geminiModel : s.claudeModel
  },
  actions: {
    reset() {
      this.provider = 'gemini'
      this.apiKey = ''
      this.geminiModel = 'gemini-2.0-flash'
      this.claudeModel = 'claude-haiku-4-5'
      this.statsBaseUrl = '/api'
      this.kioskMode = false
    }
  }
})
