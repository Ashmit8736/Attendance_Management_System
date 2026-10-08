import React from 'react';

/**
 * Catches render errors so a bug in one page shows a recovery screen instead of a blank page.
 */
export class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-screen" role="alert">
        <h1>Something went wrong</h1>
        <p>The page hit an unexpected error. Your data is safe. Reload to try again.</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
