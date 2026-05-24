import { StrictMode, Component, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
        }}>
          <div style={{ maxWidth: 720, width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: 'var(--panel)' }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>App failed to render</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
              A runtime error occurred. This replaces the blank screen so the failure is visible.
            </p>
            <pre style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 8,
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}>
              {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function GlobalErrorReporter({ children }) {
  const [runtimeError, setRuntimeError] = useState(null)

  useEffect(() => {
    const onError = (event) => setRuntimeError(event.error || new Error(event.message))
    const onRejection = (event) => setRuntimeError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)))

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (runtimeError) {
    return <AppErrorBoundary>{runtimeError && <AppErrorPanel error={runtimeError} />}</AppErrorBoundary>
  }

  return children
}

function AppErrorPanel({ error }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ maxWidth: 720, width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: 'var(--panel)' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>App error</h1>
        <pre style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          overflowX: 'auto',
        }}>
          {error?.stack || error?.message || String(error)}
        </pre>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <GlobalErrorReporter>
        <App />
      </GlobalErrorReporter>
    </AppErrorBoundary>
  </StrictMode>
)
