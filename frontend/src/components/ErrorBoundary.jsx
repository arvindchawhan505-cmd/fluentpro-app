import React from "react";

/**
 * Global React error boundary. If any descendant throws during render,
 * we show a friendly retry card instead of a white screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught:", error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const msg = this.state.error?.message || "Something unexpected happened.";
    return (
      <div
        role="alert"
        data-testid="error-boundary-card"
        className="flex min-h-screen items-center justify-center bg-slate-50 p-6"
      >
        <div className="w-full max-w-md rounded-3xl border-2 border-rose-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-500 text-2xl text-white">
            😅
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-900" style={{ fontFamily: "Nunito, sans-serif" }}>
            Oops — that didn't work
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Don't worry, your progress is safe. Give it another go.
          </p>
          <details className="mt-3 text-left text-[11px] text-slate-400">
            <summary className="cursor-pointer font-bold uppercase tracking-wider">Technical details</summary>
            <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 font-mono">{msg}</pre>
          </details>
          <button
            onClick={this.handleReload}
            data-testid="error-boundary-reload"
            className="mt-5 w-full rounded-xl border-b-4 border-indigo-700 bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3 font-extrabold text-white active:translate-y-1 active:border-b-0"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
