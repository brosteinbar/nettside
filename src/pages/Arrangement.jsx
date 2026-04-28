import { useEffect, useState, useCallback, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Arrangement.css'

const DAYS_NO = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
const MONTHS_NO = ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
                   'juli', 'august', 'september', 'oktober', 'november', 'desember']

const DAY_OPTIONS = [
  { value: '1', label: 'Mandag' },
  { value: '2', label: 'Tirsdag' },
  { value: '3', label: 'Onsdag' },
  { value: '4', label: 'Torsdag' },
  { value: '5', label: 'Fredag' },
  { value: '6', label: 'Lørdag' },
  { value: '0', label: 'Søndag' },
]

function cronDayIndex(cron) {
  return parseInt(cron.split(' ')[4])
}

function formatTime(t) {
  return t?.slice(0, 5) ?? ''
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${day}. ${MONTHS_NO[month - 1]} ${year}`
}

function getWeekMonday(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d
}

function getWeekKey(dateStr) {
  if (!dateStr) return ''
  const m = getWeekMonday(dateStr)
  return `${m.getFullYear()}-${m.getMonth()}-${m.getDate()}`
}

function getWeekLabel(dateStr) {
  const monday = getWeekMonday(dateStr)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = dt => `${dt.getDate()}. ${MONTHS_NO[dt.getMonth()].slice(0, 3)}`
  return `${fmt(monday)} – ${fmt(sunday)}`
}

function formatVirtualDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return `${DAYS_NO[d.getDay()]} ${day}. ${MONTHS_NO[month - 1]}`
}

function getNextOccurrences(dayOfWeek, count = 4) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const current = new Date(today)
  const daysUntil = (dayOfWeek - current.getDay() + 7) % 7
  current.setDate(current.getDate() + daysUntil)
  const result = []
  for (let i = 0; i < count; i++) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    result.push(`${y}-${m}-${d}`)
    current.setDate(current.getDate() + 7)
  }
  return result
}

function expandAndSortEvents(events) {
  const expanded = []
  for (const event of events) {
    if (event.cron) {
      for (const dateStr of getNextOccurrences(cronDayIndex(event.cron), 4)) {
        expanded.push({ ...event, _virtualDate: dateStr })
      }
    } else {
      expanded.push(event)
    }
  }
  return expanded.sort((a, b) => {
    const da = a._virtualDate ?? a.date ?? ''
    const db = b._virtualDate ?? b.date ?? ''
    return da.localeCompare(db)
  })
}

function EventForm({ event, onSave, onCancel }) {
  const isRecurring = event?.cron != null
  const [vals, setVals] = useState({
    title:       event?.title ?? '',
    description: event?.description ?? '',
    type:        isRecurring ? 'recurring' : 'one-time',
    day:         isRecurring ? String(cronDayIndex(event.cron)) : '1',
    date:        event?.date ?? '',
    start_time:  event?.start_time ? formatTime(event.start_time) : '',
    end_time:    event?.end_time   ? formatTime(event.end_time)   : '',
  })
  const set = f => e => setVals(v => ({ ...v, [f]: e.target.value }))

  function handleSave() {
    if (!vals.title.trim() || !vals.start_time) return
    onSave({
      title:       vals.title.trim(),
      description: vals.description.trim() || null,
      cron:        vals.type === 'recurring' ? `* * * * ${vals.day}` : null,
      date:        vals.type === 'one-time'  ? vals.date || null : null,
      start_time:  vals.start_time,
      end_time:    vals.end_time || null,
    })
  }

  return (
    <div className="event-form">
      <input
        className="event-form-title"
        placeholder="Tittel *"
        value={vals.title}
        onChange={set('title')}
        autoFocus
      />
      <textarea
        className="event-form-desc"
        placeholder="Beskrivelse"
        value={vals.description}
        onChange={set('description')}
        rows={2}
      />
      <div className="event-form-type">
        <label>
          <input type="radio" value="one-time" checked={vals.type === 'one-time'} onChange={set('type')} />
          Engangsarrangement
        </label>
        <label>
          <input type="radio" value="recurring" checked={vals.type === 'recurring'} onChange={set('type')} />
          Tilbakevendende
        </label>
      </div>
      {vals.type === 'one-time' ? (
        <input type="date" value={vals.date} onChange={set('date')} />
      ) : (
        <select value={vals.day} onChange={set('day')}>
          {DAY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      <div className="event-form-times">
        <input type="time" value={vals.start_time} onChange={set('start_time')} />
        <span>–</span>
        <input type="time" value={vals.end_time} onChange={set('end_time')} />
      </div>
      <div className="event-form-actions">
        <button onClick={handleSave}>Lagre</button>
        <button onClick={onCancel}>Avbryt</button>
      </div>
    </div>
  )
}

function EventCard({ event, isAdmin, onEdit, onDelete, isPast, isWeekEnd }) {
  const timeRange = formatTime(event.start_time) +
    (event.end_time ? `–${formatTime(event.end_time)}` : '')
  const when = event._virtualDate
    ? formatVirtualDate(event._virtualDate)
    : formatDate(event.date)

  return (
    <div className={`event-card${isPast ? ' event-card--past' : ''}${isWeekEnd ? ' event-card--week-end' : ''}`}>
      <div className="event-card-when">{when}, {timeRange}</div>
      <div className="event-card-title">{event.title}</div>
      {event.description && <div className="event-card-desc">{event.description}</div>}
      {isAdmin && (
        <div className="event-card-actions">
          <button onClick={() => onEdit(event)} title="Rediger">✎</button>
          <button onClick={() => onDelete(event.id)} title="Slett">×</button>
        </div>
      )}
    </div>
  )
}

export default function Arrangement() {
  const { user } = useAuth()
  const isAdmin = !!user
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [mutationError, setMutationError] = useState(null)

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase.from('events').select('*')
    if (error) { setMutationError('Kunne ikke laste arrangementer.'); setLoading(false); return }
    setEvents(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  async function handleCreate(vals) {
    const { data, error } = await supabase.from('events').insert(vals).select().single()
    if (error) { setMutationError('Kunne ikke opprette arrangement.'); return }
    setEvents(prev => [...prev, data])
    setShowNewForm(false)
  }

  async function handleUpdate(id, vals) {
    const { error } = await supabase.from('events').update(vals).eq('id', id)
    if (error) { setMutationError('Kunne ikke oppdatere arrangement.'); return }
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...vals } : e))
    setEditingId(null)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { setMutationError('Kunne ikke slette arrangement.'); return }
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div className="arrangement-loading">Laster arrangementer…</div>

  const _now = new Date()
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const expandedEvents = expandAndSortEvents(events)
  let editFormShown = false

  return (
    <div className="arrangement-page">
      {mutationError && <p className="form-error" style={{ textAlign: 'center', padding: '0.5rem 0' }}>{mutationError}</p>}
      {expandedEvents.length === 0 && !showNewForm && (
        <p className="arrangement-empty">Ingen kommende arrangementer.</p>
      )}
      <div className="arrangement-list">
        {expandedEvents.map((event, i) => {
          const key = event._virtualDate ? `${event.id}-${event._virtualDate}` : String(event.id)
          const eventDate = event._virtualDate ?? event.date ?? ''
          const prevDate = i > 0 ? (expandedEvents[i - 1]._virtualDate ?? expandedEvents[i - 1].date ?? '') : null
          const showDivider = i > 0 && getWeekKey(eventDate) !== getWeekKey(prevDate ?? '')
          const nextDate = i < expandedEvents.length - 1 ? (expandedEvents[i + 1]._virtualDate ?? expandedEvents[i + 1].date ?? '') : null
          const isWeekEnd = !nextDate || getWeekKey(eventDate) !== getWeekKey(nextDate)

          if (editingId === event.id) {
            if (editFormShown) return null
            editFormShown = true
            return (
              <Fragment key={key}>
                {showDivider && <div className="week-divider">{getWeekLabel(eventDate)}</div>}
                <EventForm
                  event={event}
                  onSave={vals => handleUpdate(event.id, vals)}
                  onCancel={() => setEditingId(null)}
                />
              </Fragment>
            )
          }
          return (
            <Fragment key={key}>
              {showDivider && <div className="week-divider">{getWeekLabel(eventDate)}</div>}
              <EventCard
                event={event}
                isAdmin={isAdmin}
                onEdit={e => { setShowNewForm(false); setEditingId(e.id) }}
                onDelete={handleDelete}
                isPast={!event._virtualDate && event.date < today}
                isWeekEnd={isWeekEnd}
              />
            </Fragment>
          )
        })}
        {showNewForm && (
          <EventForm
            event={null}
            onSave={handleCreate}
            onCancel={() => setShowNewForm(false)}
          />
        )}
      </div>

      {isAdmin && !showNewForm && !editingId && (
        <div className="arrangement-footer">
          <button className="btn-add-event" onClick={() => setShowNewForm(true)}>
            + Legg til arrangement
          </button>
        </div>
      )}
    </div>
  )
}
