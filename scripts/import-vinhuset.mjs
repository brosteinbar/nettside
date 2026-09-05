// Imports Vinhuset's full product catalog into Supabase (vendor_products) so the
// admin "Produktsøk" page can search producers/products. Runs nightly in GitHub
// Actions (.github/workflows/import-vinhuset.yml) and can be run locally:
//
//   npm run import:vinhuset -- --dry-run                 # fetch + map, write nothing
//   npm run import:vinhuset -- --producer "Ettore Germano"
//   npm run import:vinhuset
//
// Env (GitHub secrets, or .env.local when running locally):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (service role bypasses RLS; never commit it)
// Optional env instead of flags: PRODUCER, DRY_RUN=true, TRIGGER_SOURCE.
//
// Vinhuset runs Dynamics 365 Commerce; its Retail Server answers anonymously.
// The producer *facet* endpoints are truncated, so producers are derived from
// the product rows (VH-Produsent) rather than fetched as a list. Categories come
// from Vinhuset's own category tree (see buildCategoryMaps), with Vinmonopolet's
// category attributes as fallback.

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(import.meta.url), '../..')

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const VENDOR = 'vinhuset'
const RS_BASE = 'https://scu3ethdxfz95689836-rs.su.retail.dynamics.com/Commerce'
const API_VERSION = '7.3'
const CHANNEL_ID = 5637144576
const CATALOG_ID = 0
const ROOT_CATEGORY_ID = 5637144576        // "Alle varer"
const PRODUCER_REFINER_ID = 5637151327     // refiner "Produsent"
const VINHUSET_HEADERS = {
  OUN: 'N001OSL',
  'Accept-Language': 'nb-NO',
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

const PAGE_SIZE = 1000          // Retail Server caps $top at 1000
const BATCH_SIZE = 500          // rows per upsert request
const MAX_RETRIES = 4
const FETCH_TIMEOUT_MS = 60_000
const MIN_SEEN_RATIO = 0.9      // refuse to deactivate if a full run saw < 90 % of last time
const EMPTY_DATE = '1900-01-01T00:00:00Z'

// ---------------------------------------------------------------------------
// Args / env
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const hasFlag = name => args.includes(name)
const optValue = name => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

await loadDotEnvLocal()

const DRY_RUN = hasFlag('--dry-run') || /^true$/i.test(process.env.DRY_RUN ?? '')
const PRODUCER = (optValue('--producer') ?? process.env.PRODUCER ?? '').trim() || null
const TRIGGER_SOURCE = optValue('--source') ?? process.env.TRIGGER_SOURCE ?? 'local'
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (set env vars or .env.local).')
  process.exit(1)
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ---------------------------------------------------------------------------
// Vinhuset fetch
// ---------------------------------------------------------------------------
class RetryableError extends Error {}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// GET/POST against the Retail Server with timeout and retry on 429/5xx/network errors.
async function vinhusetFetch(url, init = {}) {
  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { ...init, headers: VINHUSET_HEADERS, signal: controller.signal })
      if (res.status === 429 || res.status >= 500) throw new RetryableError(`Vinhuset HTTP ${res.status}`)
      if (!res.ok) throw new Error(`Vinhuset HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
      return await res.json()
    } catch (err) {
      const retryable = err instanceof RetryableError || err.name === 'AbortError' || err.name === 'TypeError'
      if (!retryable || attempt > MAX_RETRIES) throw err
      const delay = 2000 * 2 ** (attempt - 1)
      console.warn(`  retry ${attempt}/${MAX_RETRIES} in ${delay} ms (${err.message})`)
      await sleep(delay)
    } finally {
      clearTimeout(timer)
    }
  }
}

// One page of products with all attributes (the heavy call, ~9 MB per page).
async function fetchPage(skip, producer) {
  const url = `${RS_BASE}/Products/SearchByCriteria?api-version=${API_VERSION}` +
    `&$top=${PAGE_SIZE}&$skip=${skip}&$count=true`
  const searchCriteria = {
    Context: { ChannelId: CHANNEL_ID, CatalogId: CATALOG_ID },
    CategoryIds: [ROOT_CATEGORY_ID],
    IncludeProductsFromDescendantCategories: true,
    SkipVariantExpansion: true,
    IncludeAttributes: true,
  }
  if (producer) {
    searchCriteria.Refinement = [{
      RefinerRecordId: PRODUCER_REFINER_ID,
      RefinerSourceValue: 1,
      LeftValueBoundString: producer,
      RightValueBoundString: producer,
      DataTypeValue: 5,
    }]
  }
  const json = await vinhusetFetch(url, { method: 'POST', body: JSON.stringify({ searchCriteria }) })
  return { items: json.value ?? [], count: json['@odata.count'] ?? null }
}

// ---------------------------------------------------------------------------
// Vinhuset category tree
// ---------------------------------------------------------------------------
// Search results carry no category, and Vinmonopolet's category attribute only
// exists for about half the products. So we ask Vinhuset which products sit in
// each of its own categories (light calls, no attributes) and map
// article number -> top-level category ("Rødvin", "Øl", "Brennevin" …) and
// article number -> leaf category ("Champagne", "Whisky", "India pale ale" …).

const stripCategoryCode = name => String(name ?? '').replace(/\s*\(\d+\)\s*$/, '').trim()  // "Rødvin (2601)" -> "Rødvin"

async function fetchCategoryItemIds(categoryId) {
  const ids = []
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const url = `${RS_BASE}/Products/SearchByCategory(channelId=${CHANNEL_ID},catalogId=${CATALOG_ID},categoryId=${categoryId})` +
      `?api-version=${API_VERSION}&$top=${PAGE_SIZE}&$skip=${skip}`
    const items = (await vinhusetFetch(url)).value ?? []
    for (const p of items) ids.push(String(p.ItemId))
    if (items.length < PAGE_SIZE) return ids
  }
}

async function buildCategoryMaps() {
  const t0 = Date.now()
  const categories = (await vinhusetFetch(`${RS_BASE}/Categories?api-version=${API_VERSION}&$top=500`)).value ?? []
  const parents = new Set(categories.map(c => c.ParentCategory))
  const topLevel = categories.filter(c => c.ParentCategory === ROOT_CATEGORY_ID)
  const leaves = categories.filter(c => c.RecordId !== ROOT_CATEGORY_ID && c.ParentCategory !== ROOT_CATEGORY_ID && !parents.has(c.RecordId))

  const category = new Map()
  for (const c of topLevel) {
    for (const id of await fetchCategoryItemIds(c.RecordId)) category.set(id, stripCategoryCode(c.Name))
  }
  const subcategory = new Map()
  for (const c of leaves) {
    for (const id of await fetchCategoryItemIds(c.RecordId)) subcategory.set(id, stripCategoryCode(c.Name))
  }
  console.log(`  categories: ${topLevel.length} top-level, ${leaves.length} leaves · ${category.size} products mapped · ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  return { category, subcategory }
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------
// AttributeValue.DataTypeValue: 1 currency, 2 datetime, 3 decimal, 4 integer, 5 text, 6 boolean
function attrValue(a) {
  switch (a.DataTypeValue) {
    case 1: return a.CurrencyValue
    case 2: return a.DateTimeOffsetValue
    case 3: return a.FloatValue
    case 4: return a.IntegerValue
    case 5: return a.TextValue
    case 6: return a.BooleanValue
    default: return a.TextValue ?? a.FloatValue ?? a.IntegerValue ?? a.BooleanValue ?? null
  }
}

const isEmpty = v =>
  v == null || v === '' || v === 0 || v === false || v === EMPTY_DATE

// KeyName is the attribute name without spaces/hyphens ("VP-Volum verdi" -> "VPVolumverdi").
const keyFor = name => String(name ?? '').replace(/[\s\-_]/g, '')

function attrMap(item) {
  const out = {}
  for (const a of item.AttributeValues ?? []) {
    let v = attrValue(a)
    if (typeof v === 'string') v = v.trim()
    if (isEmpty(v)) continue
    out[a.KeyName || keyFor(a.Name)] = v
  }
  return out
}

const text = v => {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

const num = v => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function toRow(item, attrs, seenAt, categoryMaps) {
  const get = name => attrs[keyFor(name)]
  const organic = get('VH-Økologisk')
  const itemId = String(item.ItemId)
  return {
    vendor: VENDOR,
    vendor_product_id: itemId,
    vendor_record_id: item.RecordId ?? null,
    name: text(item.Name) ?? itemId,
    producer: text(get('VH-Produsent')),
    importer: text(get('VH-Importør')),
    // Vinhuset's own grouping first (complete), Vinmonopolet's as fallback.
    category: categoryMaps.category.get(itemId) ?? text(get('VP-Hovedkategori')),
    subcategory: categoryMaps.subcategory.get(itemId) ?? text(get('VP-Mellomkategori')),
    country: text(get('VH-Opprinnelsesland')) ?? text(get('VP-Land')),
    region: text(get('VH-Distrikt')) ?? text(get('VP-Distrikt')),
    subregion: text(get('VP-Underdistrikt')),
    vintage: text(get('VH-Årgang')) ?? text(get('VP-År')),
    grapes: text(get('VP-Ingredienser')),
    volume_cl: num(get('VH-Volum(cl)')) ?? num(get('VP-Volum verdi')),
    abv: num(get('VH-ABV')) ?? num(get('VP-Alkohol verdi')),
    price: num(item.Price),
    retail_price: num(get('VP-Pris')),
    vinmonopolet_id: text(get('VH-Polnummer')),
    stock_status: text(get('VH-Beholdning')),
    lifecycle: text(get('VH-Livssyklus')),
    organic: organic == null ? null : /^(ja|true)$/i.test(String(organic)),
    image_url: text(item.PrimaryImageUrl),
    description: text(item.Description),
    unit: text(item.DefaultUnitOfMeasure),
    attributes: attrs,
    is_active: true,
    last_seen_at: seenAt,
    updated_at: seenAt,
  }
}

// PostgREST rejects an upsert containing the same key twice.
function dedupe(rows) {
  const seen = new Map()
  for (const r of rows) seen.set(r.vendor_product_id, r)
  return [...seen.values()]
}

function* chunks(arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size)
}

// Column coverage for the dry-run report (how many rows got a non-null value).
const COVERAGE_COLUMNS = ['producer', 'importer', 'category', 'subcategory', 'country', 'region', 'vintage', 'grapes',
  'volume_cl', 'abv', 'price', 'retail_price', 'stock_status', 'lifecycle', 'image_url']

// ---------------------------------------------------------------------------
// Supabase bookkeeping
// ---------------------------------------------------------------------------
async function startRun(startedAt) {
  const { data, error } = await supabase
    .from('import_runs')
    .insert({ vendor: VENDOR, status: 'running', trigger_source: TRIGGER_SOURCE, producer_filter: PRODUCER, started_at: startedAt })
    .select('id')
    .single()
  if (error) throw new Error(`Could not create import_runs row: ${error.message}`)
  return data.id
}

async function finishRun(runId, patch) {
  const { error } = await supabase
    .from('import_runs')
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq('id', runId)
  if (error) console.error(`Could not update import_runs row: ${error.message}`)
}

async function previousFullRunCount() {
  const { data, error } = await supabase
    .from('import_runs')
    .select('products_seen')
    .eq('vendor', VENDOR)
    .eq('status', 'success')
    .is('producer_filter', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Could not read previous import run: ${error.message}`)
  return data?.products_seen ?? null
}

async function upsertRows(rows) {
  const { error } = await supabase
    .from('vendor_products')
    .upsert(rows, { onConflict: 'vendor,vendor_product_id' })
  if (error) throw new Error(`Upsert failed: ${error.message}`)
}

async function deactivateUnseen(startedAt) {
  let query = supabase
    .from('vendor_products')
    .update({ is_active: false, updated_at: startedAt }, { count: 'exact' })
    .eq('vendor', VENDOR)
    .eq('is_active', true)
    .lt('last_seen_at', startedAt)
  if (PRODUCER) query = query.eq('producer', PRODUCER)
  const { count, error } = await query
  if (error) throw new Error(`Deactivation failed: ${error.message}`)
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const startedAt = new Date().toISOString()
const scope = PRODUCER ? `producer "${PRODUCER}"` : 'full catalog'
console.log(`Vinhuset import · ${scope} · ${DRY_RUN ? 'DRY RUN' : 'writing to Supabase'} · source ${TRIGGER_SOURCE}`)

const stats = { pages: 0, seen: 0, upserted: 0, deactivated: 0 }
const coverage = Object.fromEntries(COVERAGE_COLUMNS.map(c => [c, 0]))
let sampleRow = null
let runId = null

try {
  if (!DRY_RUN) runId = await startRun(startedAt)

  const categoryMaps = await buildCategoryMaps()

  let skip = 0
  let total = null
  for (;;) {
    const t0 = Date.now()
    const { items, count } = await fetchPage(skip, PRODUCER)
    if (total == null) total = count
    stats.pages++
    stats.seen += items.length

    const rows = dedupe(items.map(item => toRow(item, attrMap(item), startedAt, categoryMaps)))
    for (const r of rows) {
      for (const c of COVERAGE_COLUMNS) if (r[c] != null) coverage[c]++
    }
    if (!sampleRow && rows.length) sampleRow = rows.find(r => r.retail_price != null) ?? rows[0]

    if (!DRY_RUN) {
      for (const batch of chunks(rows, BATCH_SIZE)) {
        await upsertRows(batch)
        stats.upserted += batch.length
      }
    }

    const pageCount = total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : '?'
    console.log(`  page ${stats.pages}/${pageCount} · ${items.length} items · ${((Date.now() - t0) / 1000).toFixed(1)} s`)

    if (items.length < PAGE_SIZE) break
    skip += PAGE_SIZE
    if (total != null && skip >= total) break
  }

  if (DRY_RUN) {
    console.log(`\nDry run: ${stats.seen} products in ${stats.pages} pages, nothing written.`)
    console.log('Column coverage (rows with a value):')
    for (const c of COVERAGE_COLUMNS) {
      const pct = stats.seen ? Math.round((coverage[c] / stats.seen) * 100) : 0
      console.log(`  ${c.padEnd(13)} ${String(coverage[c]).padStart(6)}  (${pct} %)`)
    }
    if (sampleRow) {
      const { attributes, ...rest } = sampleRow
      console.log('Sample row:', JSON.stringify(rest, null, 2))
      console.log('Sample attribute keys:', Object.keys(attributes).join(', '))
    }
  } else {
    // Deactivate products Vinhuset no longer lists — guarded against truncated runs.
    if (PRODUCER && stats.seen === 0) {
      console.warn(`No products returned for "${PRODUCER}"; skipping deactivation (check the exact producer name).`)
    } else {
      if (!PRODUCER) {
        const previous = await previousFullRunCount()
        if (previous != null && stats.seen < previous * MIN_SEEN_RATIO) {
          throw new Error(`Only ${stats.seen} of previously ${previous} products seen; deactivation skipped.`)
        }
      }
      stats.deactivated = await deactivateUnseen(startedAt)
    }

    await finishRun(runId, {
      status: 'success',
      pages_fetched: stats.pages,
      products_seen: stats.seen,
      products_upserted: stats.upserted,
      products_deactivated: stats.deactivated,
    })
    console.log(`\nDone: ${stats.seen} seen · ${stats.upserted} upserted · ${stats.deactivated} deactivated · ${stats.pages} pages`)
  }
} catch (err) {
  console.error(`\nImport failed: ${err.message}`)
  if (runId) {
    await finishRun(runId, {
      status: 'failed',
      pages_fetched: stats.pages,
      products_seen: stats.seen,
      products_upserted: stats.upserted,
      products_deactivated: stats.deactivated,
      error: String(err.message).slice(0, 2000),
    })
  }
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Minimal .env.local reader for local runs (no dotenv dependency). Never
// overrides variables that are already set.
async function loadDotEnvLocal() {
  let content
  try {
    content = await readFile(resolve(root, '.env.local'), 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return
    throw err
  }
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
}
