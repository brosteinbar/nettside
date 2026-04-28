import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <p style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--fg-dim)' }}>
          Noe gikk galt. Prøv å laste siden på nytt.
        </p>
      )
    }
    return this.props.children
  }
}
