import { useEffect, useState } from 'react'

// Returns `value` after it has been stable for `ms` milliseconds.
export function useDebouncedValue(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])

  return debounced
}
