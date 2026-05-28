// Single Worker entry — owns /api/*, falls through to the static asset
// binding for the rest.
//
// Endpoints:
//   GET  /api/stats     — full parsed dataset
//   GET  /api/snapshot  — flat LLM-friendly view derived from /api/stats
//   GET  /api/health    — liveness + dataset metadata
//   POST /api/llm/chat  — proxy to NVIDIA NIM (or any OpenAI-compatible
//                         upstream) with round-robin across multiple keys.
//                         Lets the public play without bringing their own key.

import stats from '../backend/data/stats.js'

const corsRead = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}
const corsLLM = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ...corsRead,
    ...(init.headers || {})
  }
})

function buildSnapshot() {
  const u = stats.unemployment
  const b = stats.births
  const m = stats.marriages

  let modalAge = null
  if (m?.by_age_total) {
    const entries = Object.entries(m.by_age_total)
    if (entries.length) modalAge = entries.sort((a, b) => b[1] - a[1])[0][0]
  }

  return {
    generated_at: stats.meta.generated_at,
    sources: stats.meta.sources.map(s => `${s.label}（${s.file}）`),
    unemployment: u ? {
      national_rate: u.national_latest,
      period: u.latest_period,
      by_county: u.by_county_latest_year
    } : null,
    births: b ? {
      year: b.latest_year ? `民國${b.latest_year}年` : null,
      national_total: b.national_total,
      by_county: b.by_county_total,
      male_per_female: b.gender_ratio
    } : null,
    marriages: m ? {
      period: m.period,
      total: m.total,
      modal_age_group: modalAge,
      by_age: m.by_age_total
    } : null
  }
}

// ───────────────────────────────────────────────────────────────────────────
// LLM proxy with round-robin key rotation.
//
// Configuration (set via `wrangler secret put` / dashboard):
//   NVIDIA_API_KEYS       — comma or newline separated list of upstream keys.
//                           At least one required. Whitespace trimmed per entry.
//   NVIDIA_BASE_URL       — optional, defaults to NVIDIA integrate endpoint.
//                           Any /v1/chat/completions-compatible URL works.
//   NVIDIA_DEFAULT_MODEL  — optional, used when the client doesn't pass `model`.
//
// Strategy:
//   - Module-level counter rotates through keys for true round-robin within an
//     isolate. We seed the counter with a per-isolate random offset so different
//     isolates don't all start from key #0.
//   - On 401 / 429 / 5xx upstream we retry with the next key, up to one full
//     cycle. This handles a rate-limited or revoked key without dropping the
//     request.
let keyCursor = Math.floor(Math.random() * 1024)

function parseKeys(env) {
  const raw = env?.NVIDIA_API_KEYS || ''
  return raw
    .split(/[,\n]/)
    .map(k => k.trim())
    .filter(Boolean)
}

function nextKeyIndex(keysLen) {
  const i = keyCursor % keysLen
  keyCursor = (keyCursor + 1) % (keysLen * 1024)  // bound the int but stay rotating
  return i
}

async function readBodyOnce(request) {
  // Buffer the JSON once so we can replay across retries.
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function proxyLLM(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsLLM })
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsLLM }
    })
  }

  const keys = parseKeys(env)
  if (keys.length === 0) {
    return new Response(JSON.stringify({
      error: 'self-host LLM 未啟用：NVIDIA_API_KEYS secret 尚未設定'
    }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsLLM } })
  }

  const baseUrl = (env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
  const upstreamUrl = `${baseUrl}/chat/completions`
  const defaultModel = env.NVIDIA_DEFAULT_MODEL || 'qwen/qwen3.5-122b-a10b'

  const body = await readBodyOnce(request)
  if (!body || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({
      error: 'bad request: messages[] required'
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsLLM } })
  }
  if (!body.model) body.model = defaultModel
  // Force non-streaming for now — frontend uses generateText.
  body.stream = false

  const start = nextKeyIndex(keys.length)
  let lastStatus = 0
  let lastErrText = ''
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(start + attempt) % keys.length]
    const r = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    })
    if (r.ok) {
      const text = await r.text()
      return new Response(text, {
        status: r.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsLLM }
      })
    }
    lastStatus = r.status
    lastErrText = (await r.text().catch(() => '')).slice(0, 400)
    // Only rotate on transient/auth-y failures. 4xx other than 401/408/429 is the
    // client's fault and won't be fixed by another key — fail fast.
    const rotatable = r.status === 401 || r.status === 403 || r.status === 408 ||
                      r.status === 429 || r.status >= 500
    if (!rotatable) break
  }

  return new Response(JSON.stringify({
    error: `upstream LLM failed (status ${lastStatus}) after rotating ${keys.length} key(s)`,
    upstream_body: lastErrText
  }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsLLM } })
}
// ───────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/llm/chat') {
      return proxyLLM(request, env)
    }

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsRead })
      if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 })

      if (url.pathname === '/api/stats')    return json(stats)
      if (url.pathname === '/api/snapshot') return json(buildSnapshot())
      if (url.pathname === '/api/health') {
        const keys = parseKeys(env)
        return json({
          ok: true,
          generated_at: stats.meta.generated_at,
          sources: stats.meta.sources,
          llm_proxy: {
            enabled: keys.length > 0,
            keys_configured: keys.length,
            base_url: env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
            default_model: env.NVIDIA_DEFAULT_MODEL || 'qwen/qwen3.5-122b-a10b'
          }
        })
      }
      return json({ error: 'not found' }, { status: 404 })
    }

    return env.ASSETS.fetch(request)
  }
}
