import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useLoginForm(onSuccess) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Feil e-post eller passord.')
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  return { email, setEmail, password, setPassword, error, loading, handleSubmit }
}
