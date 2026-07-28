'use client';

import { Component } from 'react';

export class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[GlobalErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 32,
            background: '#030303',
            color: '#fafafa',
            textAlign: 'center',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Something went wrong</h1>
            <p style={{ color: '#a1a1aa' }}>Please try again. Your checkout state is preserved.</p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{
                border: 0,
                borderRadius: 10,
                padding: '10px 18px',
                background: '#f44a22',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Try again
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
