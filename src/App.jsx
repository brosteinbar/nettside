import Navbar from './components/Navbar'
import Logo from './components/Logo'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="hero">
        <Logo />
      </main>
    </div>
  )
}
