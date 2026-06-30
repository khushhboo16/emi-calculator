"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[emi] caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-warning/20 grid place-items-center text-warning text-2xl">
          ⚠
        </div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted">
          The calculator hit an unexpected error. This sometimes happens on older browsers that
          don't support the modern APIs the cross-tab sync depends on (BroadcastChannel,
          color-mix). The app works best on the latest Chrome, Edge, Firefox, or Safari 15.4+.
        </p>
        <div className="flex gap-2 justify-center">
          <button className="btn btn-primary" onClick={reset}>
            Try again
          </button>
          <a className="btn" href="/">
            Reload page
          </a>
        </div>
        {error?.message && (
          <details className="text-left text-xs text-muted mt-4 bg-surface-2 rounded-lg p-3">
            <summary className="cursor-pointer">Error details</summary>
            <pre className="whitespace-pre-wrap mt-2 font-mono">{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
