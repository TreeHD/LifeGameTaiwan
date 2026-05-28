// Download raw open-data files into data/raw/.
// Sources (from 台灣資料.md):
//   - 失業率: 主計總處 mp0101a10.xml (full historical 1978-now, county breakdown)
//   - 出生數: 內政部 opdadm CSV (district × gender × multiplicity)
//   - 結婚數: 內政部 statis CSV (age × marital status)
//
// Why a build step instead of fetching at runtime: Workers don't have native
// XML parsing or filesystem; doing parsing offline and shipping JSON keeps the
// runtime trivial. Also: dgbas serves an old TLS chain that Node refuses
// without --use-system-ca; we fix that here once and forget about it at runtime.

import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

const here = dirname(fileURLToPath(import.meta.url))
const RAW_DIR = resolve(here, '../data/raw')

const SOURCES = [
  {
    name: 'unemployment.xml',
    url:  'https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/230038/mp0101a10.xml',
    desc: '主計總處 縣市別失業率（月資料 1978-）'
  },
  {
    name: 'births.csv',
    url:  'https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/9E4690DB-249B-4378-A0F6-DE3CA502FC6C/resource/C89BA952-9140-47C5-805A-34F3A0773978/download',
    desc: '內政部 出生數量（行政區×性別×胎別）'
  },
  {
    name: 'marriages.csv',
    url:  'https://statis.moi.gov.tw/micst/webMain.aspx?sys=220&kind=21&type=1&funid=c0140103&cycle=4&outmode=12&utf=1&compmode=0&outkind=3&fldlst=111&codspc0=0,2,3,2,6,1,9,1,12,1,15,16,&codlst1=1111&rdm=lr4b9qnj&ym=10800&ymt=10800',
    desc: '內政部 結婚人數（年齡×婚前狀況×性別）'
  }
]

// dgbas uses an outdated cert chain; system CAs handle it but Node's bundle
// doesn't. Bypass for the build step only — content is non-sensitive open data.
const lenientAgent = new https.Agent({ rejectUnauthorized: false })

async function download(source) {
  const r = await fetch(source.url, {
    // @ts-ignore — undici-specific
    dispatcher: undefined,
    // For Node fetch the agent goes through this private knob:
    // simpler to just retry without it via a small fallback.
  }).catch(() => null)

  if (r && r.ok) return Buffer.from(await r.arrayBuffer())

  // Fallback path with permissive TLS via node:https
  return await new Promise((resolveDl, reject) => {
    const u = new URL(source.url)
    https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      agent: lenientAgent,
      headers: { 'User-Agent': 'taiwan-life-game-build/0.1' }
    }, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${source.url}`))
        return
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolveDl(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true })
  let okCount = 0
  for (const src of SOURCES) {
    try {
      const buf = await download(src)
      const out = resolve(RAW_DIR, src.name)
      await writeFile(out, buf)
      console.log(`✓ ${src.name.padEnd(20)} ${(buf.length / 1024).toFixed(1)}KB — ${src.desc}`)
      okCount++
    } catch (e) {
      console.warn(`✗ ${src.name}: ${e.message}`)
    }
  }
  console.log(`\n${okCount}/${SOURCES.length} sources downloaded → ${RAW_DIR}`)
}

main()
