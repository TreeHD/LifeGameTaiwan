// Cloudflare Pages Function — GET /api/stats
// Same data the local Node proxy serves; keeps the frontend interface stable.
import stats from '../../backend/data/stats.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export const onRequestOptions = () => new Response(null, { status: 204, headers: cors })

export const onRequestGet = () => new Response(JSON.stringify(stats), {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    ...cors
  }
})
