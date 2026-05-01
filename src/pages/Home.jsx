import { useEffect } from 'react'
import Logo from '../components/Logo'

export default function Home() {
  useEffect(() => { document.title = 'Brostein' }, [])
  return (
    <main className="hero">
      <Logo />
    </main>
  )
}
