import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebounce'
import {
  MIN_TERM_LENGTH,
  fetchFacets, latestRunQuery, producersQuery, productsQuery, sanitizeTerm,
  fmtCount, fmtDateTime, fmtNok,
} from '../lib/vendorProducts'
import './ProductSearch.css'

const INITIAL_FILTERS = { category: '', country: '', inStockOnly: false, showInactive: false }

function ImportStatus({ run }) {
  if (!run) return <p className="psearch-status">Ingen import er kjørt enda.</p>
  const when = fmtDateTime(run.finished_at ?? run.started_at)
  return (
    <div className="psearch-status">
      {run.status === 'running' ? (
        <p>Import pågår (startet {when})…</p>
      ) : run.status === 'failed' ? (
        <p className="form-error">Siste import feilet {when}: {run.error ?? 'ukjent feil'}</p>
      ) : (
        <p>Sist oppdatert {when} · {fmtCount(run.products_seen)} produkter fra Vinhuset</p>
      )}
    </div>
  )
}

function ProducerList({ producers, onSelect }) {
  if (producers.length === 0) return null
  return (
    <section className="psearch-section">
      <h2 className="psearch-heading">Produsenter</h2>
      <ul className="psearch-producers">
        {producers.map(pr => (
          <li key={pr.producer}>
            <button type="button" className="psearch-producer" onClick={() => onSelect(pr.producer)}>
              <span className="psearch-producer-name">{pr.producer}</span>
              <span className="psearch-producer-meta">
                {fmtCount(pr.product_count)} produkter
                {pr.countries?.length ? ` · ${pr.countries.slice(0, 3).join(', ')}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProductRow({ product: p }) {
  const meta = [
    p.vintage,
    p.volume_cl != null && `${fmtNok(p.volume_cl, 0)} cl`,
    p.abv != null && `${fmtNok(p.abv, 1)} %`,
    p.category,
    p.subcategory && p.subcategory !== p.category && p.subcategory,
    [p.region, p.country].filter(Boolean).join(', '),
  ].filter(Boolean)
  const sub = [p.producer, p.importer && `Importør: ${p.importer}`, p.grapes].filter(Boolean)
  const inStock = p.stock_status === 'På lager'

  return (
    <li className={`psearch-item${p.is_active ? '' : ' is-inactive'}`}>
      <div className="psearch-item-main">
        <span className="psearch-item-name">{p.name}</span>
        {meta.length > 0 && <span className="psearch-item-meta">{meta.join(' · ')}</span>}
        {sub.length > 0 && <span className="psearch-item-sub">{sub.join(' · ')}</span>}
      </div>
      <div className="psearch-item-side">
        {p.price != null && (
          <span className="psearch-price" title="Vinhusets listepris uten kundeavtale">
            Vinhuset {fmtNok(p.price)} kr
          </span>
        )}
        {p.retail_price != null && (
          <span className="psearch-polet">Polet {fmtNok(p.retail_price, 0)},-</span>
        )}
        <span className="psearch-tags">
          {!p.is_active && <span className="psearch-tag is-error">Utgått</span>}
          {p.stock_status && (
            <span className={`psearch-tag${inStock ? ' is-ok' : ''}`}>{p.stock_status}</span>
          )}
          <span className="psearch-tag">Varenr {p.vendor_product_id}</span>
        </span>
      </div>
    </li>
  )
}

export default function ProductSearch() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const term = sanitizeTerm(debouncedQuery)
  const [selectedProducer, setSelectedProducer] = useState(null)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [facets, setFacets] = useState({ categories: [], countries: [] })
  const [lastRun, setLastRun] = useState(null)
  const [producers, setProducers] = useState([])
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  const active = selectedProducer !== null || term.length >= MIN_TERM_LENGTH

  useEffect(() => {
    fetchFacets().then(setFacets).catch(() => { /* filters stay empty */ })
    latestRunQuery().then(({ data }) => setLastRun(data ?? null))
  }, [])

  useEffect(() => {
    const id = ++requestId.current
    setPage(0)
    if (!active) {
      setProducers([])
      setProducts([])
      setTotal(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    Promise.all([
      selectedProducer ? Promise.resolve({ data: [] }) : producersQuery(term),
      productsQuery({ term, producer: selectedProducer, ...filters, page: 0 }),
    ]).then(([producerRes, productRes]) => {
      if (id !== requestId.current) return
      if (producerRes.error || productRes.error) {
        setError('Kunne ikke laste produkter.')
      } else {
        setProducers(producerRes.data ?? [])
        setProducts(productRes.data ?? [])
        setTotal(productRes.count ?? 0)
      }
      setLoading(false)
    })
  }, [active, term, selectedProducer, filters])

  async function loadMore() {
    const id = requestId.current
    const nextPage = page + 1
    setLoadingMore(true)
    const { data, error: err } = await productsQuery({ term, producer: selectedProducer, ...filters, page: nextPage })
    if (id !== requestId.current) return
    setLoadingMore(false)
    if (err) {
      setError('Kunne ikke laste flere produkter.')
      return
    }
    setProducts(prev => [...prev, ...(data ?? [])])
    setPage(nextPage)
  }

  function handleQueryChange(e) {
    setQuery(e.target.value)
    setSelectedProducer(null)
  }

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }))

  return (
    <div className="psearch">
      <ImportStatus run={lastRun} />

      <div className="psearch-controls">
        <input
          type="search"
          className="psearch-input"
          placeholder="Søk etter produsent eller produkt"
          value={query}
          onChange={handleQueryChange}
          autoFocus
        />
        <div className="psearch-filters">
          <select value={filters.category} onChange={e => setFilter('category', e.target.value)} aria-label="Kategori">
            <option value="">Alle kategorier</option>
            {facets.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.country} onChange={e => setFilter('country', e.target.value)} aria-label="Land">
            <option value="">Alle land</option>
            {facets.countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="psearch-check">
            <input type="checkbox" checked={filters.inStockOnly} onChange={e => setFilter('inStockOnly', e.target.checked)} />
            Kun på lager
          </label>
          <label className="psearch-check">
            <input type="checkbox" checked={filters.showInactive} onChange={e => setFilter('showInactive', e.target.checked)} />
            Vis utgåtte
          </label>
        </div>
        {selectedProducer && (
          <div className="psearch-chip-row">
            <span className="psearch-chip">
              {selectedProducer}
              <button type="button" onClick={() => setSelectedProducer(null)} aria-label="Fjern produsentfilter">×</button>
            </span>
          </div>
        )}
      </div>

      {!active && (
        <p className="psearch-hint">Skriv minst to tegn for å søke etter produsent eller produkt.</p>
      )}

      {error && <p className="form-error psearch-error">{error}</p>}

      {active && loading && <p className="psearch-hint">Laster…</p>}

      {active && !loading && !error && (
        <>
          <ProducerList producers={producers} onSelect={setSelectedProducer} />

          <section className="psearch-section">
            <h2 className="psearch-heading">
              Produkter{total != null && <span className="psearch-count"> · {fmtCount(total)} treff</span>}
            </h2>
            {products.length === 0 ? (
              <p className="psearch-hint">Ingen treff.</p>
            ) : (
              <ul className="psearch-items">
                {products.map(p => <ProductRow key={p.id} product={p} />)}
              </ul>
            )}
            {total != null && products.length < total && (
              <button type="button" className="psearch-more" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Laster…' : `Vis flere (${fmtCount(products.length)} av ${fmtCount(total)})`}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  )
}
