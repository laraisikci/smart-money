import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// React error boundaries have no hook equivalent — a render-time throw anywhere in the tree
// (e.g. a backend response missing a field the frontend expects, one version behind after a
// deploy lag) otherwise unmounts the whole app to a blank screen with nothing on-screen
// explaining why. This catches that and offers a reload instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
          <div className="card max-w-sm p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-bear-400" />
            <p className="mt-3 text-sm font-medium text-ink-100">Something went wrong</p>
            <p className="mt-1.5 text-xs text-ink-400">
              This screen hit an unexpected error. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-teal-400/15 px-4 py-2 text-xs font-semibold text-teal-300 transition-colors hover:bg-teal-400/25"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
