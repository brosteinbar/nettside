import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function applySession(session) {
      const nextUser = session?.user ?? null
      let nextIsAdmin = false
      if (nextUser) {
        const { data } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', nextUser.id)
          .maybeSingle()
        nextIsAdmin = !!data
      }
      if (cancelled) return
      setUser(nextUser)
      setIsAdmin(nextIsAdmin)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      // Deferred: supabase-js can deadlock if its own client is awaited
      // synchronously inside the onAuthStateChange callback.
      setTimeout(() => applySession(session), 0)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({ user, isAdmin, loading }), [user, isAdmin, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
