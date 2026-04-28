import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import hamburgRaw from '../../resources/img/brostein_tegning_svart.svg?raw'
import './Navbar.css'

const MENU_ITEMS = [
  { label: 'Om oss',      href: '/' },
  { label: 'Meny',        href: '/meny' },
  { label: 'Arrangement', href: '/arrangement' },
  { label: 'Kontakt',     href: '/kontakt' },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const headerRef = useRef(null)
  const { user } = useAuth()

  useEffect(() => {
    const header    = headerRef.current
    const hamburger = header?.querySelector('.hamburger')
    if (!header || !hamburger) return
    if (window.matchMedia('(pointer: coarse)').matches) return

    const open  = () => setIsOpen(true)
    const close = () => setIsOpen(false)
    hamburger.addEventListener('mouseenter', open)
    header.addEventListener('mouseleave', close)
    return () => {
      hamburger.removeEventListener('mouseenter', open)
      header.removeEventListener('mouseleave', close)
    }
  }, [])

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const close = () => setIsOpen(false)

  return (
    <header className="site-header" ref={headerRef}>
      <nav className="navbar">
        <button
          className={`hamburger${isOpen ? ' is-open' : ''}`}
          onClick={isTouch ? () => setIsOpen(!isOpen) : undefined}
          aria-label={isOpen ? 'Lukk meny' : 'Åpne meny'}
          aria-expanded={isOpen}
          aria-controls="nav-dropdown"
          dangerouslySetInnerHTML={{ __html: hamburgRaw }}
        />
      </nav>

      <div
        id="nav-dropdown"
        className={`nav-dropdown${isOpen ? ' is-open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="nav-dropdown-inner">
          <ul className="nav-links" role="list">
            {MENU_ITEMS.map((item, i) => (
              <li key={item.label} style={{ '--item-index': i }}>
                <Link to={item.href} onClick={close}>{item.label}</Link>
              </li>
            ))}
          </ul>
          {user && (
            <div className="nav-admin-row">
              <button
                className="nav-admin-btn"
                onClick={() => { supabase.auth.signOut(); close() }}
              >
                Logg ut
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
