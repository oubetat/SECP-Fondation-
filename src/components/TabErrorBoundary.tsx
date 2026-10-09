import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Layers, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  activePatchTab?: string;
  onResetTab?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class TabErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in tab [${this.props.activePatchTab || 'UNKNOWN'}]:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  public componentDidUpdate(prevProps: Props) {
    // Automatically clear error when user switches tabs
    if (prevProps.activePatchTab !== this.props.activePatchTab && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onResetTab) {
      this.props.onResetTab();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[400px] bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center font-sans space-y-6 animate-in fade-in duration-200 my-4">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/5">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="max-w-md space-y-2">
            <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider">
              {this.props.activePatchTab || 'WORKBENCH'} — Isolated Error
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Workbench Runtime Error
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              An error occurred while executing this workbench tab. The error has been isolated to protect system state and prevent crashes.
            </p>
          </div>

          {this.state.error && (
            <div className="max-w-xl w-full p-4 bg-slate-950 border border-slate-800/80 rounded-xl text-left font-mono text-xs text-red-400 overflow-x-auto max-h-36">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Diagnostic Output:</div>
              <div>{this.state.error.toString()}</div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={this.handleGoHome}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Start Center
            </button>
            <button
              onClick={this.handleRetry}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Retry Tab
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
