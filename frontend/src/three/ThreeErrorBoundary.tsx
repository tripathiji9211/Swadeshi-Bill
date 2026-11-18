import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Box } from 'lucide-react';

export interface ThreeErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
  onReset?: () => void;
  className?: string;
}

interface ThreeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ThreeErrorBoundary extends Component<
  ThreeErrorBoundaryProps,
  ThreeErrorBoundaryState
> {
  constructor(props: ThreeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ThreeErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[ThreeErrorBoundary] 3D WebGL / R3F Exception Intercepted:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className={`w-full rounded-2xl bg-dark-900/90 border border-rose-500/30 p-6 flex flex-col items-center justify-center text-center gap-3 backdrop-blur-md relative overflow-hidden ${
            this.props.className || ''
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-1">
            <Box className="w-5 h-5 text-rose-400" />
          </div>

          <div className="space-y-1 max-w-sm">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{this.props.title || '3D Hardware Acceleration Fallback'}</span>
            </h4>
            <p className="text-xs text-slate-400">
              WebGL context was lost or hardware acceleration is unsupported. Operating in resilient
              fallback mode.
            </p>
            {this.state.error?.message && (
              <p className="text-[10px] text-rose-300/80 font-mono bg-dark-950/60 p-1.5 rounded-lg border border-white/5 truncate max-w-xs mx-auto">
                {this.state.error.message}
              </p>
            )}
          </div>

          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold border border-white/10 transition-colors active:scale-95 mt-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-400" />
            <span>Retry 3D Stage</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ThreeErrorBoundary;
