// Parse data/raw/* → data/stats.js (importable from worker.js).
//
// Output shape (frontend reads via the proxy):
// {
//   meta: { generated_at, sources[] },
//   unemployment: { national_latest, latest_period, by_county_latest_year, by_year_national },
//   births:       { latest_year, national_total, by_county_total, gender_ratio },
//   marriages:    { period, by_age_total, total }
// }
//
// Why emit JS (not JSON): Workers' JSON import assertions still need wrangler
// config; a plain JS module ships everywhere with zero ceremony.

import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const RAW = resolve(here, '../data/raw')
const OUT = resolve(here, '../data/stats.js')

// ─── Unemployment XML ───────────────────────────────────────────────
// XML is uniform-shape (one record per month), so a tag-grabber regex is fine
// and avoids dragging in xml2js for a one-off build script.

const COUNTY_TAG_MAP = {
  // Map XML element prefix → display name
  '臺灣地區_Taiwan_Area': '全國',
  '新北市_New_Taipei_City': '新北市',
  '臺北市_Taipei_City': '臺北市',
  '桃園市_Taoyuan_City': '桃園市',
  '臺中市_Taichung_City': '臺中市',
  '臺南市_Tainan_City': '臺南市',
  '高雄市_Kaohsiung_City': '高雄市',
  '基隆市_Keelung_City': '基隆市',
  '新竹市_Hsinchu_City': '新竹市',
  '新竹縣_Hsinchu_County': '新竹縣',
  '宜蘭縣_Yilan_County': '宜蘭縣',
  '苗栗縣_Miaoli_County': '苗栗縣',
  '彰化縣_Changhua_County': '彰化縣',
  '南投縣_Nantou_County': '南投縣',
  '雲林縣_Yunlin_County': '雲林縣',
  '嘉義市_Chiayi_City': '嘉義市',
  '嘉義縣_Chiayi_County': '嘉義縣',
  '屏東縣_Pingtung_County': '屏東縣',
  '花蓮縣_Hualien_County': '花蓮縣',
  '臺東縣_Taitung_County': '臺東縣',
  '澎湖縣_Penghu_County': '澎湖縣',
  '金門縣_Kinmen_County': '金門縣',
  '連江縣_Lienchiang_County': '連江縣'
}

function parseUnemployment(xml) {
  const records = []
  const blockRe = /<縣市別失業率>([\s\S]*?)<\/縣市別失業率>/g
  let m
  while ((m = blockRe.exec(xml))) {
    const block = m[1]
    const period = (block.match(/<年月別_Year_and_month>([^<]+)<\/年月別_Year_and_month>/) || [])[1]
    if (!period) continue
    const rec = { period }
    for (const [prefix, label] of Object.entries(COUNTY_TAG_MAP)) {
      const tag = new RegExp(`<${prefix}_百分比>([^<]*)</${prefix}_百分比>`)
      const v = (block.match(tag) || [])[1]
      const n = parseFloat(v)
      if (!Number.isNaN(n)) rec[label] = n
    }
    records.push(rec)
  }

  records.sort((a, b) => String(a.period).localeCompare(String(b.period)))
  if (records.length === 0) {
    return { national_latest: null, latest_period: null, by_county_latest_year: {}, by_year_national: {} }
  }

  const latest = records[records.length - 1]
  // Most recent 12 months → per-county yearly average for the latest year
  const last12 = records.slice(-12)
  const byCounty = {}
  for (const label of Object.values(COUNTY_TAG_MAP)) {
    const vals = last12.map(r => r[label]).filter(v => typeof v === 'number')
    if (vals.length > 0) byCounty[label] = round1(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  // Per-year national series (for trend, last 30 years)
  const byYear = {}
  for (const r of records) {
    const yr = String(r.period).slice(0, -2)  // YYYYMM → YYYY
    if (!yr || typeof r['全國'] !== 'number') continue
    byYear[yr] = byYear[yr] || []
    byYear[yr].push(r['全國'])
  }
  const byYearAvg = {}
  for (const [yr, arr] of Object.entries(byYear)) byYearAvg[yr] = round1(arr.reduce((a, b) => a + b, 0) / arr.length)

  return {
    national_latest: latest['全國'] ?? null,
    latest_period: latest.period,
    by_county_latest_year: byCounty,
    by_year_national: byYearAvg
  }
}

// ─── Births CSV (BOM, headers: 統計年,按照別,行政區域代碼,區域別,性別,胎別,嬰兒出生數) ─
function parseBirths(csv) {
  const rows = csvParse(csv)
  if (rows.length === 0) return { latest_year: null, national_total: 0, by_county_total: {}, gender_ratio: null }
  const header = rows.shift()
  const idx = (k) => header.indexOf(k)
  const yearIdx = idx('統計年')
  const basisIdx = idx('按照別')
  const districtIdx = idx('區域別')
  const genderIdx = idx('性別')
  const countIdx = idx('嬰兒出生數')

  // Pick latest year
  const years = [...new Set(rows.map(r => r[yearIdx]).filter(Boolean))].sort()
  const latestYear = years[years.length - 1]

  const byCounty = {}
  let total = 0, male = 0, female = 0
  for (const r of rows) {
    if (r[yearIdx] !== latestYear) continue
    if (r[basisIdx] !== '按登記日期分') continue
    const district = r[districtIdx] || ''
    const gender = r[genderIdx] || ''
    const n = parseInt(r[countIdx], 10) || 0
    total += n
    if (gender === '男') male += n
    else if (gender === '女') female += n
    // First 3 chars of district are typically the city
    const cityMatch = district.match(/^([^縣市]+[縣市])/)
    if (cityMatch) {
      const city = cityMatch[1]
      byCounty[city] = (byCounty[city] || 0) + n
    }
  }

  return {
    latest_year: latestYear,
    national_total: total,
    by_county_total: byCounty,
    gender_ratio: female > 0 ? round2(male / female) : null
  }
}

// ─── Marriages CSV (no header row beyond ROC-year/age/state/total/M/F) ──
// Lines look like: "108年/ 25-29歲/ 未婚",72304,31575,40729
function parseMarriages(csv) {
  const rows = csvParse(csv)
  if (rows.length === 0) return { period: null, by_age_total: {}, total: 0 }
  const out = { period: null, by_age_total: {}, total: 0 }
  for (const row of rows) {
    const desc = row[0] || ''
    if (!/年.*\/.*\//.test(desc)) continue
    const parts = desc.split('/').map(s => s.trim())
    const yearPart = parts[0]            // "108年"
    const agePart  = parts[1]            // "25-29歲" or "年齡別總計"
    const statePart = parts[2]           // "婚前狀況總計" / "未婚" ...
    const total = parseInt(row[1], 10)
    const male  = parseInt(row[2], 10)
    const female = parseInt(row[3], 10)

    if (!out.period) out.period = yearPart
    if (statePart !== '婚前狀況總計') continue
    if (agePart === '年齡別總計') {
      out.total = Number.isFinite(total) ? total : 0
      out.male_total = Number.isFinite(male) ? male : 0
      out.female_total = Number.isFinite(female) ? female : 0
      continue
    }
    if (Number.isFinite(total) && agePart) {
      out.by_age_total[agePart] = total
    }
  }
  return out
}

// ─── Tiny CSV parser (handles BOM + quoted commas + simple escapes) ────
function csvParse(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const rows = []
  let cur = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { cur.push(cell); cell = '' }
    else if (c === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = '' }
    else if (c === '\r') {/* swallow */}
    else cell += c
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur) }
  return rows.filter(r => r.some(c => c && c.length > 0))
}

const round1 = (n) => Math.round(n * 10) / 10
const round2 = (n) => Math.round(n * 100) / 100

async function readIfExists(path) {
  try { await stat(path); return await readFile(path, 'utf8') }
  catch { return null }
}

async function main() {
  const [unempXml, birthsCsv, marriagesCsv] = await Promise.all([
    readIfExists(resolve(RAW, 'unemployment.xml')),
    readIfExists(resolve(RAW, 'births.csv')),
    readIfExists(resolve(RAW, 'marriages.csv'))
  ])

  const stats = {
    meta: {
      generated_at: new Date().toISOString(),
      sources: [
        { id: 'unemployment', label: '主計總處：縣市別失業率', file: 'unemployment.xml', present: !!unempXml },
        { id: 'births',       label: '內政部：出生數量',       file: 'births.csv',       present: !!birthsCsv },
        { id: 'marriages',    label: '內政部：結婚人數',       file: 'marriages.csv',    present: !!marriagesCsv }
      ]
    },
    unemployment: unempXml ? parseUnemployment(unempXml) : null,
    births:       birthsCsv ? parseBirths(birthsCsv)     : null,
    marriages:    marriagesCsv ? parseMarriages(marriagesCsv) : null
  }

  const banner = `// AUTO-GENERATED by scripts/build.js — do not edit.\n` +
                 `// Run \`npm run build:data\` to refresh from data/raw/.\n` +
                 `// Generated at: ${stats.meta.generated_at}\n`
  await writeFile(OUT, `${banner}export default ${JSON.stringify(stats, null, 2)}\n`)
  console.log(`✓ wrote ${OUT}`)
  console.log(`  unemployment.national_latest: ${stats.unemployment?.national_latest}% @ ${stats.unemployment?.latest_period}`)
  console.log(`  births.latest_year: ${stats.births?.latest_year}, total=${stats.births?.national_total}`)
  console.log(`  marriages.period: ${stats.marriages?.period}, total=${stats.marriages?.total}`)
}

main()
