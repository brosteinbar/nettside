import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './TimeAdmin.css'

const OPEN_LIMIT_MS = 12 * 60 * 60 * 1000

const pad2 = n => String(n).padStart(2, '0')

// Device-local date/time (the bar device runs Europe/Oslo time).
const toDateInput = ts => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
const toTimeInput = ts => {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const fromInputs = (date, time) =>
  date && time ? new Date(`${date}T${time}`).toISOString() : null

const fmt = ts =>
  new Date(ts).toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const durationLabel = (a, b) => {
  const mins = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000))
  return `${Math.floor(mins / 60)} t ${mins % 60} min`
}

function EntryEditor({ entry, onSaved, onCancel }) {
  const [inDate, setInDate] = useState(() => toDateInput(entry.clock_in))
  const [inTime, setInTime] = useState(() => toTimeInput(entry.clock_in))
  const [outDate, setOutDate] = useState(() => toDateInput(entry.clock_out ?? entry.clock_in))
  const [outTime, setOutTime] = useState(() => (entry.clock_out ? toTimeInput(entry.clock_out) : ''))
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setError(null)
    const clockIn = fromInputs(inDate, inTime)
    const clockOut = outTime ? fromInputs(outDate, outTime) : null
    if (!clockIn) {
      setError('Innstempling må fylles ut.')
      return
    }
    if (clockOut && clockOut < clockIn) {
      setError('Utstempling kan ikke være før innstempling.')
      return
    }
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('correct_entry', {
      p_entry_id: entry.id,
      p_clock_in: clockIn,
      p_clock_out: clockOut,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (rpcError) {
      setError('Kunne ikke lagre korrigeringen.')
      return
    }
    onSaved()
  }

  return (
    <div className="timeadmin-editor">
      <div className="timeadmin-editor-row">
        <label>Inn</label>
        <input type="date" aria-label="Dato inn" value={inDate} onChange={e => setInDate(e.target.value)} />
        <input type="time" aria-label="Klokkeslett inn" value={inTime} onChange={e => setInTime(e.target.value)} />
      </div>
      <div className="timeadmin-editor-row">
        <label>Ut</label>
        <input type="date" aria-label="Dato ut" value={outDate} onChange={e => setOutDate(e.target.value)} />
        <input type="time" aria-label="Klokkeslett ut" value={outTime} onChange={e => setOutTime(e.target.value)} />
      </div>
      <input
        placeholder="Årsak til korrigering"
        aria-label="Årsak til korrigering"
        value={note}
        onChange={e => setNote(e.target.value)}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="timeadmin-editor-actions">
        <button onClick={save} disabled={busy}>Lagre</button>
        <button onClick={onCancel} disabled={busy}>Avbryt</button>
      </div>
    </div>
  )
}

function CorrectionsLog({ rows }) {
  if (!rows) return <p className="timeadmin-corrections-empty">Laster…</p>
  if (rows.length === 0) return <p className="timeadmin-corrections-empty">Ingen korrigeringer.</p>
  return (
    <ul className="timeadmin-corrections">
      {rows.map(c => (
        <li key={c.id}>
          {fmt(c.edited_at)}: {fmt(c.old_clock_in)} – {c.old_clock_out ? fmt(c.old_clock_out) : 'åpen'}
          {' → '}
          {fmt(c.new_clock_in)} – {c.new_clock_out ? fmt(c.new_clock_out) : 'åpen'}
          {c.note && <em> «{c.note}»</em>}
        </li>
      ))}
    </ul>
  )
}

function EntryRow({ entry, nowMs, editingId, expandedId, corrections, onEdit, onCancelEdit, onSaved, onToggleLog }) {
  const isOpen = !entry.clock_out
  const forgotten = isOpen && nowMs - new Date(entry.clock_in).getTime() > OPEN_LIMIT_MS
  return (
    <li className="timeadmin-entry">
      <div className="timeadmin-row">
        <span>{entry.employees?.name ?? 'Ukjent'}</span>
        {forgotten && <span className="timeadmin-badge">Glemt utstempling?</span>}
        <span className="timeadmin-times">
          {fmt(entry.clock_in)} – {isOpen ? 'åpen' : fmt(entry.clock_out)}
          {!isOpen && ` (${durationLabel(entry.clock_in, entry.clock_out)})`}
        </span>
        <button onClick={() => onToggleLog(entry.id)}>Logg</button>
        <button onClick={() => onEdit(entry.id)}>Rediger</button>
      </div>
      {expandedId === entry.id && <CorrectionsLog rows={corrections[entry.id]} />}
      {editingId === entry.id && (
        <EntryEditor entry={entry} onSaved={onSaved} onCancel={onCancelEdit} />
      )}
    </li>
  )
}

export default function TimeAdmin({ onEntriesChanged }) {
  const [employees, setEmployees] = useState([])
  const [openEntries, setOpenEntries] = useState([])
  const [history, setHistory] = useState([])
  const [corrections, setCorrections] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState(null)

  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')

  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
  })
  const [filterTo, setFilterTo] = useState(() => toDateInput(new Date()))

  const fetchEmployees = useCallback(async () => {
    const { data, error: err } = await supabase.from('employees').select('*').order('name')
    if (err) { setError('Kunne ikke laste ansatte.'); return }
    setEmployees(data ?? [])
  }, [])

  const fetchOpen = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('time_entries')
      .select('*, employees(name)')
      .is('clock_out', null)
      .order('clock_in')
    if (err) { setError('Kunne ikke laste åpne stemplinger.'); return }
    setOpenEntries(data ?? [])
  }, [])

  const fetchHistory = useCallback(async () => {
    if (!filterFrom || !filterTo) return
    const fromISO = new Date(`${filterFrom}T00:00`).toISOString()
    const toExclusive = new Date(`${filterTo}T00:00`)
    toExclusive.setDate(toExclusive.getDate() + 1)
    let query = supabase
      .from('time_entries')
      .select('*, employees(name)')
      .gte('clock_in', fromISO)
      .lt('clock_in', toExclusive.toISOString())
      .order('clock_in', { ascending: false })
    if (filterEmployee) query = query.eq('employee_id', filterEmployee)
    const { data, error: err } = await query
    if (err) { setError('Kunne ikke laste historikk.'); return }
    setHistory(data ?? [])
  }, [filterEmployee, filterFrom, filterTo])

  useEffect(() => { fetchEmployees(); fetchOpen() }, [fetchEmployees, fetchOpen])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  async function handleAddEmployee(e) {
    e.preventDefault()
    setError(null)
    if (!newName.trim()) { setError('Navn må fylles ut.'); return }
    if (!/^[0-9]{4}$/.test(newPin)) { setError('Koden må være nøyaktig fire sifre.'); return }
    const { error: err } = await supabase
      .from('employees')
      .insert({ name: newName.trim(), pin: newPin })
    if (err) {
      setError(err.code === '23505' ? 'Koden er allerede i bruk.' : 'Kunne ikke legge til ansatt.')
      return
    }
    setNewName('')
    setNewPin('')
    fetchEmployees()
  }

  async function handleRemoveEmployee(emp) {
    if (!window.confirm(`Fjerne ${emp.name}? Tidligere stemplinger beholdes.`)) return
    setError(null)
    const { error: err } = await supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', emp.id)
    if (err) { setError('Kunne ikke fjerne ansatt.'); return }
    fetchEmployees()
  }

  async function handleToggleLog(entryId) {
    if (expandedId === entryId) { setExpandedId(null); return }
    setExpandedId(entryId)
    const { data } = await supabase
      .from('entry_corrections')
      .select('*')
      .eq('entry_id', entryId)
      .order('edited_at')
    setCorrections(prev => ({ ...prev, [entryId]: data ?? [] }))
  }

  function handleEntrySaved() {
    setEditingId(null)
    setCorrections({})
    setExpandedId(null)
    fetchOpen()
    fetchHistory()
    onEntriesChanged()
  }

  const activeEmployees = employees.filter(emp => !emp.deleted_at)
  const nowMs = Date.now()
  const rowProps = {
    nowMs, editingId, expandedId, corrections,
    onEdit: setEditingId,
    onCancelEdit: () => setEditingId(null),
    onSaved: handleEntrySaved,
    onToggleLog: handleToggleLog,
  }

  return (
    <section className="timeadmin">
      <h2 className="stempel-subtitle">Administrasjon</h2>
      {error && <p className="form-error">{error}</p>}

      <h3 className="timeadmin-heading">Ansatte</h3>
      <ul className="timeadmin-list">
        {activeEmployees.map(emp => (
          <li key={emp.id} className="timeadmin-row">
            <span>{emp.name}</span>
            <span className="timeadmin-pin">{emp.pin}</span>
            <button onClick={() => handleRemoveEmployee(emp)}>Fjern</button>
          </li>
        ))}
        {activeEmployees.length === 0 && (
          <li className="stempel-empty">Ingen ansatte registrert.</li>
        )}
      </ul>
      <form className="timeadmin-add" onSubmit={handleAddEmployee}>
        <input
          placeholder="Navn"
          aria-label="Navn"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input
          placeholder="Kode (4 sifre)"
          aria-label="Kode, fire sifre"
          inputMode="numeric"
          maxLength={4}
          value={newPin}
          onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
        />
        <button type="submit">Legg til</button>
      </form>

      <h3 className="timeadmin-heading">Åpne stemplinger</h3>
      <ul className="timeadmin-list">
        {openEntries.map(entry => (
          <EntryRow key={entry.id} entry={entry} {...rowProps} />
        ))}
        {openEntries.length === 0 && (
          <li className="stempel-empty">Ingen åpne stemplinger.</li>
        )}
      </ul>

      <h3 className="timeadmin-heading">Historikk</h3>
      <div className="timeadmin-filters">
        <select
          aria-label="Ansatt"
          value={filterEmployee}
          onChange={e => setFilterEmployee(e.target.value)}
        >
          <option value="">Alle ansatte</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.name}{emp.deleted_at ? ' (sluttet)' : ''}
            </option>
          ))}
        </select>
        <input type="date" aria-label="Fra dato" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        <input type="date" aria-label="Til dato" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
      </div>
      <ul className="timeadmin-list">
        {history.map(entry => (
          <EntryRow key={entry.id} entry={entry} {...rowProps} />
        ))}
        {history.length === 0 && (
          <li className="stempel-empty">Ingen stemplinger i valgt periode.</li>
        )}
      </ul>
    </section>
  )
}
