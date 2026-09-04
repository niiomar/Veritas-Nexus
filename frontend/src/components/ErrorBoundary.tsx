import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Must be a class component - React has no hook equivalent for
// componentDidCatch/getDerivedStateFromError. Without this, a render-time
// exception anywhere in the tree white-screened the whole app with no
// recovery path other than a manual refresh the user had no prompt to make.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: '#050505', color: 'var(--text-main)', gap: '20px', padding: '24px', textAlign: 'center' }}>
          <AlertTriangle size={32} color="var(--c-crit, #ef4444)" />
          <div className="mono" style={{ fontSize: '13px', letterSpacing: '0.1em', color: 'var(--c-crit, #ef4444)' }}>
            UNEXPECTED ERROR
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px' }}>
            Something went wrong rendering the workstation. Your data is untouched - reloading usually resolves this.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mono hover-bright"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '10px 20px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.1em' }}
          >
            RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
