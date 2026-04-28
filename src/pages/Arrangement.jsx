import { useEffect, useState, useCallback } from 'react'
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

function sortEvents(events) {
  const recurring = events
    .filter(e => e.cron)
    .sort((a, b) => {
      const da = cronDayIndex(a.cron) || 7
      const db = cronDayIndex(b.cron) || 7
      return da - db
    })
  const oneTime = events
    .filter(e => !e.cron)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  return [...recurring, ...oneTime]
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

function EventCard({ event, isAdmin, onEdit, onDelete, isPast }) {
  const timeRange = formatTime(event.start_time) +
    (event.end_time ? `–${formatTime(event.end_time)}` : '')
  const when = event.cron
    ? `Hver ${DAYS_NO[cronDayIndex(event.cron)].toLowerCase()}`
    : formatDate(event.date)

  return (
    <div className={`event-card${isPast ? ' event-card--past' : ''}`}>
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

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*')
    setEvents(sortEvents(data ?? []))
    setLoading(false)
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  async function handleCreate(vals) {
    const { data } = await supabase.from('events').insert(vals).select().single()
    if (data) setEvents(prev => sortEvents([...prev, data]))
    setShowNewForm(false)
  }

  async function handleUpdate(id, vals) {
    await supabase.from('events').update(vals).eq('id', id)
    setEvents(prev => sortEvents(prev.map(e => e.id === id ? { ...e, ...vals } : e)))
    setEditingId(null)
  }

  async function handleDelete(id) {
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div className="arrangement-loading">Laster arrangementer…</div>

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="arrangement-page">
      {events.length === 0 && !showNewForm && (
        <p className="arrangement-empty">Ingen kommende arrangementer.</p>
      )}
      <div className="arrangement-list">
        {events.map(event =>
          editingId === event.id ? (
            <EventForm
              key={event.id}
              event={event}
              onSave={vals => handleUpdate(event.id, vals)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <EventCard
              key={event.id}
              event={event}
              isAdmin={isAdmin}
              onEdit={e => { setShowNewForm(false); setEditingId(e.id) }}
              onDelete={handleDelete}
              isPast={!event.cron && event.date < today}
            />
          )
        )}
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
