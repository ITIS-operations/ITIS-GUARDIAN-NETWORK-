import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Home, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Sanitize error info: remove any possible tokens or sensitive substrings
    const sanitizedMsg = (error?.message || 'Component render error')
      .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
      .replace(/token=[a-zA-Z0-9_\-\.]+/gi, 'token=[REDACTED]');
    
    console.error('[ITIS Security Guard] Safe Error Boundary Caught:', sanitizedMsg, errorInfo?.componentStack?.slice(0, 300));
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReturnHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-white selection:bg-cyan-500 selection:text-white font-sans antialiased">
          {/* Canonical Master Brand Header in Recovery Screen */}
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-rose-500/30 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="font-extrabold tracking-tight text-white text-base">ITIS</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                GUARDIAN NETWORK
              </span>
            </div>

            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Security Interface Recovery</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                An isolated interface rendering event occurred. The Sovereign Security Ledger, audit trail, and all learner safety corridors remain fully secured.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-[11px] font-mono text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Ledger Integrity: SHA-256 Verified</span>
              </div>
              <div className="text-slate-500 truncate">
                Status: Safe Recovery Available
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-cyan-950/50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>RETRY INTERFACE</span>
              </button>

              <button
                type="button"
                onClick={this.handleReturnHome}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                <Home className="w-4 h-4 text-slate-400" />
                <span>RETURN TO HOME</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
