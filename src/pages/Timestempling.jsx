import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoginForm } from '../components/LoginForm'
import TimeAdmin from '../components/TimeAdmin'
import './Timestempling.css'

const LOCKOUT_LIMIT = 5
const LOCKOUT_SECONDS = 30

const osloTime = ts =>
  new Date(ts).toLocaleTimeString('nb-NO', {
    timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit',
  })

const osloDateTime = ts =>
  new Date(ts).toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

const isToday = ts => {
  const fmt = d => d.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo' })
  return fmt(new Date(ts)) === fmt(new Date())
}

function PinPad({ onToggled }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [fails, setFails] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const feedbackTimer = useRef(null)

  const locked = lockedUntil !== null && now < lockedUntil

  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [locked])

  useEffect(() => () => clearTimeout(feedbackTimer.current), [])

  function showFeedback(kind, text) {
    clearTimeout(feedbackTimer.current)
    setFeedback({ kind, text })
    feedbackTimer.current = setTimeout(() => setFeedback(null), 6000)
  }

  async function submit(code) {
    setBusy(true)
    const { data, error } = await supabase.rpc('clock_toggle', { p_pin: code })
    setBusy(false)
    setPin('')
    if (error) {
      showFeedback('error', 'Noe gikk galt. Prøv igjen.')
      return
    }
    if (data.status === 'invalid_pin') {
      const nextFails = fails + 1
      if (nextFails >= LOCKOUT_LIMIT) {
        setFails(0)
        setNow(Date.now())
        setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000)
      } else {
        setFails(nextFails)
        showFeedback('error', 'Feil kode.')
      }
      return
    }
    setFails(0)
    if (data.status === 'clocked_in') {
      showFeedback('in', `Velkommen på jobb, ${data.name} — innstemplet kl. ${osloTime(data.clock_in)}`)
    } else {
      showFeedback('out', `God tur hjem, ${data.name} — utstemplet kl. ${osloTime(data.clock_out)}`)
    }
    onToggled()
  }

  function press(digit) {
    if (busy || locked) return
    const next = (pin + digit).slice(0, 4)
    setPin(next)
    if (next.length === 4) submit(next)
  }

  function erase() {
    if (!busy && !locked) setPin(p => p.slice(0, -1))
  }

  function clearAll() {
    if (!busy && !locked) setPin('')
  }

  useEffect(() => {
    const onKey = e => {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      else if (e.key === 'Backspace') erase()
      else if (e.key === 'Escape') clearAll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const remaining = locked ? Math.ceil((lockedUntil - now) / 1000) : 0

  return (
    <section className="pinpad" aria-label="Stemple inn eller ut">
      <div className="pinpad-display" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={`pinpad-dot${i < pin.length ? ' is-filled' : ''}`} />
        ))}
      </div>
      <div className="pinpad-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => press(d)} disabled={busy || locked}>{d}</button>
        ))}
        <button onClick={clearAll} disabled={busy || locked} aria-label="Tøm">C</button>
        <button onClick={() => press('0')} disabled={busy || locked}>0</button>
        <button onClick={erase} disabled={busy || locked} aria-label="Slett siste siffer">⌫</button>
      </div>
      <p className={`pinpad-status${locked || feedback?.kind === 'error' ? ' is-error' : feedback ? ' is-ok' : ''}`} aria-live="polite">
        {locked
          ? `For mange forsøk — låst i ${remaining} s.`
          : feedback
            ? feedback.text
            : 'Tast din firesifrede kode for å stemple inn eller ut.'}
      </p>
    </section>
  )
}

function CurrentlyIn({ rows }) {
  return (
    <section className="stempel-current">
      <h2 className="stempel-subtitle">På jobb nå</h2>
      {rows.length === 0 ? (
        <p className="stempel-empty">Ingen er innstemplet.</p>
      ) : (
        <table className="stempel-table">
          <thead>
            <tr><th>Navn</th><th>Innstemplet</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.entry_id}>
                <td>{r.name}</td>
                <td>{isToday(r.clock_in) ? `kl. ${osloTime(r.clock_in)}` : osloDateTime(r.clock_in)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default function Timestempling() {
  const { user, isAdmin, loading } = useAuth()
  const [current, setCurrent] = useState([])
  const [loadError, setLoadError] = useState(null)

  const fetchCurrent = useCallback(async () => {
    const { data, error } = await supabase.rpc('currently_clocked_in')
    if (error) {
      setLoadError('Kunne ikke laste hvem som er på jobb.')
      return
    }
    setLoadError(null)
    setCurrent(data ?? [])
  }, [])

  useEffect(() => { document.title = 'Timestempling — Brostein' }, [])

  useEffect(() => {
    if (!user) return
    fetchCurrent()
    const id = setInterval(fetchCurrent, 60_000)
    return () => clearInterval(id)
  }, [user, fetchCurrent])

  if (loading) return null

  if (!user) {
    return (
      <div className="stempel-login">
        <div className="stempel-login-box">
          <h1 className="stempel-title">Timestempling</h1>
          <LoginForm formClassName="admin-form" submitClassName="admin-submit" />
        </div>
      </div>
    )
  }

  return (
    <div className="stempel-page">
      <h1 className="stempel-title">Timestempling</h1>
      <PinPad onToggled={fetchCurrent} />
      {loadError && <p className="form-error stempel-load-error">{loadError}</p>}
      <CurrentlyIn rows={current} />
      {isAdmin && <TimeAdmin onEntriesChanged={fetchCurrent} />}
    </div>
  )
}
