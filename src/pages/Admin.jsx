import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './Admin.css'

export default function Admin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Feil e-post eller passord.')
      setLoading(false)
    } else {
      navigate('/meny')
    }
  }

  if (user) {
    return (
      <div className="admin-page">
        <div className="admin-box">
          <p className="admin-logged-in">Logget inn som {user.email}</p>
          <button
            className="admin-submit"
            onClick={() => supabase.auth.signOut()}
          >
            Logg ut
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-box">
        <h1 className="admin-title">Admin</h1>
        <form className="admin-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="E-post"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
          />
          <input
            type="password"
            placeholder="Passord"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="admin-error">{error}</div>}
          <button type="submit" className="admin-submit" disabled={loading}>
            {loading ? 'Logger inn…' : 'Logg inn'}
          </button>
        </form>
      </div>
    </div>
  )
}
