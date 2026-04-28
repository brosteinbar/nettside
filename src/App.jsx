import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import './App.css'

const Menu        = lazy(() => import('./pages/Menu'))
const Kontakt     = lazy(() => import('./pages/Kontakt'))
const Admin       = lazy(() => import('./pages/Admin'))
const Arrangement = lazy(() => import('./pages/Arrangement'))

const PageFallback = () => (
  <p style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--fg-dim)' }}>
    Laster…
  </p>
)

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
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/meny" element={<Menu />} />
                <Route path="/kontakt" element={<Kontakt />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/arrangement" element={<Arrangement />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </HashRouter>
    </AuthProvider>
  )
}
