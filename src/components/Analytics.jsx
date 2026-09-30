import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Umami is loaded in index.html with auto-track off, so page views are
// reported here on every route change. Staff-only routes are skipped so
// daily clock-ins and admin work don't drown out real visitors.
const EXCLUDED_PREFIXES = ['/admin', '/timestempling', '/produktsok']

const isExcluded = pathname =>
  EXCLUDED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))

export default function Analytics() {
  const { pathname } = useLocation()
  const isFirstView = useRef(true)

  useEffect(() => {
    if (isExcluded(pathname)) return

    // Short delay so the page's document.title update lands first,
    // mirroring what Umami's own auto-tracker does.
    const timer = setTimeout(() => {
      const umami = window.umami
      if (!umami) return
      const first = isFirstView.current
      isFirstView.current = false
      umami.track(props => ({
        ...props,
        url: pathname,
        title: document.title,
        // Only the first view carries the external referrer. Later views
        // are internal navigation and should not count as new referrals.
        referrer: first ? props.referrer : '',
      }))
    }, 300)

    return () => clearTimeout(timer)
  }, [pathname])

  return null
}
