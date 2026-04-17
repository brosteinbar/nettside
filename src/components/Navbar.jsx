import { useState } from 'react'
import hamburgRaw from '../../resources/img/brostein_tegning_svart.svg?raw'
import './Navbar.css'

const MENU_ITEMS = [
  { label: 'Om oss', href: '#' },
  { label: 'Meny', href: '#' },
  { label: 'Arrangementer', href: '#' },
  { label: 'Kontakt', href: '#' },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="site-header">
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
                <a href={item.href} onClick={() => setIsOpen(false)}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  )
}
