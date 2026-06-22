import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    // Track error in analytics if available
    if (window.analytics) {
      window.analytics.track('error_boundary_caught', {
        error: error.toString(),
        componentStack: info.componentStack,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Scoped error (e.g., Step 3 component)
      if (this.props.scoped) {
        return (
          <div style={{
            padding: '24px 20px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12,
            textAlign: 'center',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: 'rgba(255,255,255,0.7)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'rgba(255,255,255,0.9)' }}>
              Something went wrong with this section
            </div>
            <div style={{ fontSize: 12, marginBottom: 16, color: 'rgba(255,255,255,0.5)' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '8px 16px',
                background: 'rgba(0,212,170,0.15)',
                border: '1px solid rgba(0,212,170,0.3)',
                borderRadius: 8,
                color: '#00d4aa',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.target.style.background = 'rgba(0,212,170,0.25)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'rgba(0,212,170,0.15)';
              }}
            >
              Try again
            </button>
          </div>
        );
      }

      // Full page error
      return (
        <div style={{ minHeight: '100vh', background: '#06090f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff', textAlign: 'center', padding: 24 }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, marginBottom: 10 }}>Something went wrong</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>We've hit an unexpected bump. Try refreshing the page.</div>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              Back to home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
