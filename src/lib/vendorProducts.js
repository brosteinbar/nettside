// Query builders and formatters for the imported vendor catalog
// (vendor_products & co, see supabase/migrations/20260905000000_vendor_products.sql).
// Read-only: all writes happen in scripts/import-vinhuset.mjs.

import { supabase } from './supabase'

export const VENDOR = 'vinhuset'
export const PAGE_SIZE = 50
export const PRODUCER_LIMIT = 20
export const MIN_TERM_LENGTH = 2

export const PRODUCT_COLUMNS =
  'id, vendor, vendor_product_id, vendor_record_id, name, producer, importer, category, subcategory, ' +
  'country, region, subregion, vintage, grapes, volume_cl, abv, price, retail_price, ' +
  'stock_status, lifecycle, organic, is_active'

// PostgREST's `.or()` splits on commas/parentheses and `%`/`_` are ilike wildcards,
// so strip them from user input before interpolating.
export function sanitizeTerm(term) {
  return (term ?? '').replace(/[%_,()"\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function producersQuery(term) {
  return supabase
    .from('vendor_producers')
    .select('vendor, producer, product_count, countries, categories')
    .eq('vendor', VENDOR)
    .ilike('producer', `%${term}%`)
    .gt('product_count', 0)
    .order('product_count', { ascending: false })
    .order('producer')
    .limit(PRODUCER_LIMIT)
}

export function productsQuery({ term, producer, category, country, inStockOnly, showInactive, page = 0 }) {
  let query = supabase
    .from('vendor_products')
    .select(PRODUCT_COLUMNS, { count: 'exact' })
    .eq('vendor', VENDOR)

  if (producer) query = query.eq('producer', producer)
  else if (term) query = query.or(`producer.ilike.%${term}%,name.ilike.%${term}%`)

  if (!showInactive) query = query.eq('is_active', true)
  if (category) query = query.eq('category', category)
  if (country) query = query.eq('country', country)
  if (inStockOnly) query = query.eq('stock_status', 'På lager')

  const from = page * PAGE_SIZE
  return query
    .order('producer', { nullsFirst: false })
    .order('name')
    .order('vintage', { ascending: false, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1)
}

export async function fetchFacets() {
  const [categories, countries] = await Promise.all([
    supabase.from('vendor_product_categories').select('category, product_count').eq('vendor', VENDOR).order('product_count', { ascending: false }),
    supabase.from('vendor_product_countries').select('country, product_count').eq('vendor', VENDOR).order('product_count', { ascending: false }),
  ])
  if (categories.error) throw categories.error
  if (countries.error) throw countries.error
  return {
    categories: categories.data.map(r => r.category),
    countries: countries.data.map(r => r.country),
  }
}

export function latestRunQuery() {
  return supabase
    .from('import_runs')
    .select('status, started_at, finished_at, products_seen, products_upserted, products_deactivated, producer_filter, error')
    .eq('vendor', VENDOR)
    .eq('dry_run', false)
    .is('producer_filter', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

export const fmtCount = n => (n ?? 0).toLocaleString('nb-NO')

export const fmtNok = (n, digits = 2) =>
  n == null ? null : n.toLocaleString('nb-NO', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const fmtDateTime = ts =>
  new Date(ts).toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
