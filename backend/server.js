// Local-dev Node adapter that reuses the Workers fetch handler.
// On Cloudflare Workers, worker.js is the entry directly; here we wrap it
// in node:http so `npm run dev` works the same as `wrangler dev`.

import { createServer } from 'node:http'
import worker from './worker.js'

const PORT = process.env.PORT || 8000

function nodeReqToFetch(req) {
  const url = `http://${req.headers.host || 'localhost'}${req.url}`
  return new Request(url, {
    method: req.method,
    headers: req.headers,
    // GETs are bodyless; this proxy only serves GET so we don't pipe body.
    duplex: 'half'
  })
}

async function fetchRespToNode(fetchResp, res) {
  res.statusCode = fetchResp.status
  fetchResp.headers.forEach((v, k) => res.setHeader(k, v))
  const buf = Buffer.from(await fetchResp.arrayBuffer())
  res.end(buf)
}

createServer(async (req, res) => {
  try {
    const request = nodeReqToFetch(req)
    const response = await worker.fetch(request, {})
    await fetchRespToNode(response, res)
  } catch (err) {
    console.error(err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: String(err?.message || err) }))
  }
}).listen(PORT, () => {
  console.log(`stats-proxy listening on http://localhost:${PORT}`)
  console.log(`  GET /api/stats`)
  console.log(`  GET /api/health`)
})
