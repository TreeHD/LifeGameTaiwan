// Taiwan Life Game — Stats proxy
//
// Serves the build-time-generated data/stats.js. No runtime fetching of
// gov.tw endpoints (their TLS / availability / CORS isn't worth depending on
// at request time), no hardcoded "national snapshot" tables. Refresh data via
// `npm run refresh` (= fetch + build).
//
// Endpoints:
//   GET /api/stats     — full parsed dataset (unemployment + births + marriages)
//   GET /api/snapshot  — flat LLM-friendly view derived from /api/stats
//   GET /api/health    — liveness + dataset metadata

import stats from './data/stats.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ...cors,
    ...(init.headers || {})
  }
})

// LLM-friendly flattened view. Computed at request time — cheap, in-memory.
function buildSnapshot() {
  const u = stats.unemployment
  const b = stats.births
  const m = stats.marriages

  // Median-ish marriage age bucket: pick the modal age range.
  let modalAge = null
  if (m?.by_age_total) {
    const entries = Object.entries(m.by_age_total)
    if (entries.length) {
      modalAge = entries.sort((a, b) => b[1] - a[1])[0][0]
    }
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

async function handleStats() {
  return json({ ...stats })
}

async function handleSnapshot() {
  return json(buildSnapshot())
}

async function handleHealth() {
  return json({
    ok: true,
    generated_at: stats.meta.generated_at,
    sources: stats.meta.sources
  })
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (url.pathname === '/api/stats')    return handleStats()
    if (url.pathname === '/api/snapshot') return handleSnapshot()
    if (url.pathname === '/api/health')   return handleHealth()
    if (url.pathname === '/' || url.pathname === '') {
      return json({
        name: 'taiwan-life-game-stats-proxy',
        endpoints: ['/api/stats', '/api/snapshot', '/api/health'],
        generated_at: stats.meta.generated_at
      })
    }
    return json({ error: 'not found' }, { status: 404 })
  }
}
