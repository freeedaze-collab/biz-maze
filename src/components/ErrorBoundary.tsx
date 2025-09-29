import { Component, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: err?.message || String(err) };
  }

  componentDidCatch(err: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('Runtime error:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h1 style={{ fontWeight: 700, fontSize: 18 }}>Something went wrong.</h1>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12, color: '#b91c1c' }}>
            {this.state.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
