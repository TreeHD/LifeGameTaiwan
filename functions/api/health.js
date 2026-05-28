// Cloudflare Pages Function — GET /api/health
import stats from '../../backend/data/stats.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export const onRequestOptions = () => new Response(null, { status: 204, headers: cors })

export const onRequestGet = () => new Response(JSON.stringify({
  ok: true,
  generated_at: stats.meta.generated_at,
  sources: stats.meta.sources
}), {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    ...cors
  }
})
