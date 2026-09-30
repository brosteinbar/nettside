import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import hamburgRaw from '../../resources/img/brostein_tegning_svart.svg?raw'
import './Navbar.css'

const MENU_ITEMS = [
  { label: 'Hjem',        href: '/' },
  { label: 'Meny',        href: '/meny' },
  { label: 'Vinmeny',     href: '/vinmeny' },
  { label: 'Arrangement', href: '/arrangement' },
  { label: 'Kontakt',     href: '/kontakt' },
]

const matchesTouch = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

// True when launched from a home screen icon (iOS "Add to Home Screen" or an
// installed PWA). The staff pages are deliberately unlinked on the public site,
// but the installed app is only ever on staff devices, so it may link to them.
// Display mode is fixed for the lifetime of the page, so evaluate it once.
const IS_STANDALONE =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isTouch, setIsTouch] = useState(matchesTouch)
  const headerRef = useRef(null)
  const { user, isAdmin } = useAuth()
  const close = () => setIsOpen(false)

  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)')
    const onChange = e => setIsTouch(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const header    = headerRef.current
    const hamburger = header?.querySelector('.hamburger')
    if (!header || !hamburger || isTouch) return

    const open = () => setIsOpen(true)
    hamburger.addEventListener('mouseenter', open)
    header.addEventListener('mouseleave', close)
    return () => {
      hamburger.removeEventListener('mouseenter', open)
      header.removeEventListener('mouseleave', close)
    }
  }, [isTouch])

  useEffect(() => {
    if (!isOpen) return
    const onKey = e => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  function handleSignOut() {
    // Local scope: only sign out this device. The default (global) revokes every
    // session for the account, which also kicks out the shared bar iPad.
    supabase.auth.signOut({ scope: 'local' }).catch(err => console.error('Sign out failed:', err))
    close()
  }

  return (
    <header className="site-header" ref={headerRef}>
      <nav className="navbar">
        <button
          className={`hamburger${isOpen ? ' is-open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
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
          {(user || IS_STANDALONE) && (
            <div className="nav-admin-row">
              <Link className="nav-admin-btn" to="/timestempling" onClick={close}>
                Timestempling
              </Link>
              {isAdmin && (
                <Link className="nav-admin-btn" to="/produktsok" onClick={close}>
                  Produktsøk
                </Link>
              )}
              {user && (
                <button className="nav-admin-btn" onClick={handleSignOut}>
                  Logg ut
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
