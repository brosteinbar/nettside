import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Menu from './pages/Menu'
import Kontakt from './pages/Kontakt'
import Admin from './pages/Admin'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="app">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/meny" element={<Menu />} />
            <Route path="/kontakt" element={<Kontakt />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  )
}
