// Browser-side LLM client. Four providers, single interface.
//
// Gemini: plain fetch — the v1beta REST API is permissive enough that pulling
// in @google/generative-ai for one call would just bloat the bundle.
// Claude: official SDK with `dangerouslyAllowBrowser` because Anthropic guards
// against accidental key leakage. Acceptable here — see README caveat.
// OpenAI-compat: any /v1/chat/completions endpoint (OpenAI, Groq, OpenRouter,
// DeepSeek, Together, Ollama, LM Studio, …). Endpoint is user-configurable.
// Selfhost: hits this site's own /api/llm/chat — the Worker proxies to a
// shared upstream (e.g. NVIDIA NIM) using server-side keys with round-robin
// rotation. The user doesn't bring a key.
//
// Both go through `generateJSON` which strips ``` fences and retries once with
// a stricter instruction. LLMs occasionally wrap output in markdown despite
// the prompt — one retry is enough; a second usually means the prompt is bad,
// not the model.

import Anthropic from '@anthropic-ai/sdk'

const stripFence = (s) => s.trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim()

class GeminiClient {
  constructor({ apiKey, model }) {
    this.apiKey = apiKey
    this.model = model || 'gemini-2.0-flash'
  }

  async generateText(system, user, { maxTokens = 1024 } = {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`
    const body = {
      systemInstruction: { role: 'system', parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9 }
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      throw new Error(`Gemini API ${r.status}: ${errText.slice(0, 200)}`)
    }
    const data = await r.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini 回傳空內容')
    return text
  }
}

class ClaudeClient {
  constructor({ apiKey, model }) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    this.model = model || 'claude-haiku-4-5'
  }

  async generateText(system, user, { maxTokens = 1024 } = {}) {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
    const block = resp.content.find(b => b.type === 'text')
    if (!block) throw new Error('Claude 回傳空內容')
    return block.text
  }
}

// OpenAI-compatible chat completions. Works with any provider that implements
// /v1/chat/completions: OpenAI, Groq, OpenRouter, DeepSeek, Together, Ollama,
// LM Studio, etc. Both base URL and model are user-configurable.
class OpenAIClient {
  constructor({ apiKey, model, baseUrl }) {
    this.apiKey = apiKey
    this.model = model || 'gpt-4o-mini'
    // Tolerate trailing slash; we always append /chat/completions.
    this.baseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  }

  async generateText(system, user, { maxTokens = 1024 } = {}) {
    const url = `${this.baseUrl}/chat/completions`
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      temperature: 0.9,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      throw new Error(`OpenAI-compat API ${r.status}: ${errText.slice(0, 200)}`)
    }
    const data = await r.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('OpenAI-compat 回傳空內容')
    return text
  }
}

// Selfhost — proxied through this site's own Worker at /api/llm/chat.
// The Worker holds the upstream keys (e.g. NVIDIA NIM) and round-robins
// across them, so the user doesn't need to bring their own key.
class SelfhostClient {
  constructor({ baseUrl } = {}) {
    // Default to same-origin /api so the static deploy "just works" with the
    // bundled Worker. Override via settings.selfhostBaseUrl if needed.
    this.baseUrl = (baseUrl || '/api').replace(/\/+$/, '')
  }

  async generateText(system, user, { maxTokens = 1024 } = {}) {
    const url = `${this.baseUrl}/llm/chat`
    const body = {
      max_tokens: maxTokens,
      temperature: 0.9,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      throw new Error(`Self-host LLM ${r.status}: ${errText.slice(0, 200)}`)
    }
    const data = await r.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('Self-host LLM 回傳空內容')
    return text
  }
}

class LLM {
  constructor(impl) { this.impl = impl }

  async generateText(system, user, opts) {
    return (await this.impl.generateText(system, user, opts)).trim()
  }

  async generateJSON(system, user, opts = {}) {
    let lastRaw = ''
    let lastErr = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const augmentedUser = attempt === 0
        ? user
        : `${user}\n\n（上次輸出無法解析為 JSON。請重新輸出合法 JSON，不要任何前言、不要 markdown 框架。）`
      const raw = await this.impl.generateText(system, augmentedUser, opts)
      lastRaw = raw
      try {
        return JSON.parse(stripFence(raw))
      } catch (e) {
        lastErr = e
      }
    }
    throw new Error(`LLM 無法輸出合法 JSON：${lastErr?.message}\n--- raw ---\n${lastRaw.slice(0, 300)}`)
  }
}

export function createLLM(settings) {
  const { provider, geminiModel, claudeModel, openaiModel, openaiBaseUrl, selfhostBaseUrl } = settings
  if (provider === 'selfhost') {
    return new LLM(new SelfhostClient({ baseUrl: selfhostBaseUrl }))
  }
  const apiKey = settings.currentApiKey
  if (!apiKey) throw new Error('未設定 API Key')
  if (provider === 'gemini') return new LLM(new GeminiClient({ apiKey, model: geminiModel }))
  if (provider === 'claude') return new LLM(new ClaudeClient({ apiKey, model: claudeModel }))
  if (provider === 'openai') return new LLM(new OpenAIClient({ apiKey, model: openaiModel, baseUrl: openaiBaseUrl }))
  throw new Error(`未知的 provider: ${provider}`)
}
