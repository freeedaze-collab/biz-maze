// src/components/ErrorBoundary.tsx
import React from 'react'

type Props = { children: React.ReactNode }

type State = { hasError: boolean; error?: Error | null; info?: string | null }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // 画面にも表示
    this.setState({ info: errorInfo?.componentStack ?? '' })
    // コンソールにも
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-sm">
          <h1 className="text-lg font-semibold mb-2">Something went wrong.</h1>
          <pre className="whitespace-pre-wrap text-red-700">
            {this.state.error?.message}
          </pre>
          {this.state.info && (
            <details className="mt-3">
              <summary>stack</summary>
              <pre className="whitespace-pre-wrap text-gray-700">{this.state.info}</pre>
            </details>
          )}
          <div className="mt-4">
            <a className="underline" href="/_debug">Open /_debug</a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
