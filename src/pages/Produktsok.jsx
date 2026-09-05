import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { LoginForm } from '../components/LoginForm'
import ProductSearch from '../components/ProductSearch'
import './Produktsok.css'

export default function Produktsok() {
  const { user, isAdmin, loading } = useAuth()

  useEffect(() => { document.title = 'Produktsøk — Brostein' }, [])

  if (loading) return null

  if (!user) {
    return (
      <div className="psok-login">
        <div className="psok-login-box">
          <h1 className="psok-title">Produktsøk</h1>
          <LoginForm onSuccess={() => {}} formClassName="admin-form" submitClassName="admin-submit" />
        </div>
      </div>
    )
  }

  return (
    <div className="psok-page">
      <h1 className="psok-title">Produktsøk</h1>
      {isAdmin
        ? <ProductSearch />
        : <p className="psok-denied">Du har ikke tilgang til produktsøk.</p>}
    </div>
  )
}
