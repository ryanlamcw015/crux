import { AlertTriangle } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Catches render crashes so one broken widget shows a message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Crux render error:', error.message, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
        <AlertTriangle className="size-8 text-score-poor" />
        <h2 className="text-xl font-semibold">Something slipped</h2>
        <p className="text-sm text-ink-300">This page hit an unexpected error. Try reloading.</p>
        <button onClick={() => window.location.reload()} className="mt-2 rounded-xl bg-chalk px-4 py-2 text-sm font-semibold text-ink-950">
          Reload
        </button>
      </div>
    )
  }
}
