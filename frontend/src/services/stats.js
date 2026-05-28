// Stats fetcher.
// Hits /api/snapshot which returns LLM-friendly flattened data sourced from
// 主計總處（失業率）、內政部（出生數、結婚數）— see backend/data/stats.js.
//
// Fallback: an empty snapshot. Prompts gracefully omit fields that are missing,
// so the game still runs offline (just without live numbers in the prompt context).

const EMPTY_SNAPSHOT = {
  generated_at: null,
  sources: ['（離線：未連接 stats proxy，使用 LLM 內建知識）'],
  unemployment: null,
  births: null,
  marriages: null
}

export async function fetchStats(baseUrl = '/api') {
  if (!baseUrl) return EMPTY_SNAPSHOT
  try {
    const r = await fetch(`${baseUrl}/snapshot`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } catch (e) {
    console.warn('[stats] backend unavailable, running without live data:', e.message)
    return EMPTY_SNAPSHOT
  }
}
