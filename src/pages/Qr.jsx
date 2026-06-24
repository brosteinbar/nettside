import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Qr.css'

export default function Qr() {
  useEffect(() => { document.title = 'Velkommen — Brostein' }, [])
  return (
    <main className="qr-page">
      <p className="qr-greeting">Kom inn, vi biter ikke! :)</p>
      <Link className="qr-meny" to="/meny">meny</Link>
    </main>
  )
}
