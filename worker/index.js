// Single Worker entry — owns /api/*, falls through to the static asset
// binding for the rest. Replaces the old Pages Functions (functions/api/*)
// and the standalone backend/worker.js stats proxy.
//
// Endpoints:
//   GET /api/stats     — full parsed dataset
//   GET /api/snapshot  — flat LLM-friendly view derived from /api/stats
//   GET /api/health    — liveness + dataset metadata

import stats from '../backend/data/stats.js'

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
      if (request.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405 })

      if (url.pathname === '/api/stats')    return json(stats)
      if (url.pathname === '/api/snapshot') return json(buildSnapshot())
      if (url.pathname === '/api/health') {
        return json({
          ok: true,
          generated_at: stats.meta.generated_at,
          sources: stats.meta.sources
        })
      }
      return json({ error: 'not found' }, { status: 404 })
    }

    return env.ASSETS.fetch(request)
  }
}
