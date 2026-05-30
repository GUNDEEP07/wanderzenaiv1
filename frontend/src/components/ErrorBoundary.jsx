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
  }

  render() {
    if (this.state.hasError) {
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
