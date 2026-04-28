import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoginForm } from '../components/LoginForm'
import './Admin.css'

export default function Admin() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) return null

  if (user) {
    return (
      <div className="admin-page">
        <div className="admin-box">
          <p className="admin-logged-in">Logget inn som {user.email}</p>
          <button className="admin-submit" onClick={() => supabase.auth.signOut()}>
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
        <LoginForm
          onSuccess={() => navigate('/meny')}
          formClassName="admin-form"
          submitClassName="admin-submit"
        />
      </div>
    </div>
  )
}
