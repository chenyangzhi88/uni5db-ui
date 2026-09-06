import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
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
          display: 'grid',
          placeItems: 'center',
          background: '#101010',
          color: '#f2f2f2',
          fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
          padding: 24,
        }}>
          <div style={{
            width: 'min(720px, 100%)',
            border: '1px solid #5f302d',
            borderRadius: 6,
            background: '#171717',
            padding: 20,
          }}>
            <h1 style={{ margin: '0 0 12px', fontSize: 20 }}>UI render failed</h1>
            <pre style={{
              whiteSpace: 'pre-wrap',
              color: '#ffb4ad',
              background: '#241414',
              border: '1px solid #5f302d',
              borderRadius: 5,
              padding: 12,
              overflow: 'auto',
            }}>{this.state.error?.stack || this.state.error?.message || String(this.state.error)}</pre>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('redis.activeView')
                window.location.reload()
              }}
              style={{
                height: 38,
                marginTop: 14,
                border: 0,
                borderRadius: 6,
                background: '#005f89',
                color: '#8fe2ff',
                padding: '0 16px',
              }}
            >
              Reset view and reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
