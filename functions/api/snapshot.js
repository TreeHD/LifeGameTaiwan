// Cloudflare Pages Function — GET /api/snapshot
// LLM-friendly flattened view of the parsed stats. Mirrors backend/worker.js's
// buildSnapshot exactly so dev (Node) and prod (Pages) return the same shape.
import stats from '../../backend/data/stats.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

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

export const onRequestOptions = () => new Response(null, { status: 204, headers: cors })

export const onRequestGet = () => new Response(JSON.stringify(buildSnapshot()), {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ...cors
  }
})
