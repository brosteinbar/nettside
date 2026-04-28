import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Menu from './pages/Menu'
import Kontakt from './pages/Kontakt'
import Admin from './pages/Admin'
import Arrangement from './pages/Arrangement'
import './App.css'

const NotFound = () => (
  <p style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--fg-dim)' }}>
    Siden finnes ikke.
  </p>
)

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="app">
          <Navbar />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/meny" element={<Menu />} />
              <Route path="/kontakt" element={<Kontakt />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/arrangement" element={<Arrangement />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </HashRouter>
    </AuthProvider>
  )
}
