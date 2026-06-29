"use client";

import { useWorkspace } from "./WorkspaceProvider";

export function Header() {
  const { tabLabel, activeTabs, isLeader, state, setState, canUndo, canRedo, undo, redo } =
    useWorkspace();

  const toggleTheme = () =>
    setState((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }));

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent grid place-items-center text-white font-bold">
            ₹
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">EMI Calculator</h1>
            <p className="text-[11px] text-muted leading-tight">
              Shared workspace · syncs across tabs in real time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip" title={`This tab: ${tabLabel}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Tab {tabLabel}
            {isLeader && (
              <span title="Leader tab — provides initial state to new tabs" className="text-accent">
                ★
              </span>
            )}
          </span>
          <span className="chip" title={activeTabs.map((t) => t.label).join(", ")}>
            {activeTabs.length} active
            {activeTabs.length === 1 ? " tab" : " tabs"}
          </span>

          <div className="flex gap-1 ml-1">
            <button
              className="btn-ghost px-2 py-1 text-sm"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl/Cmd+Z)"
              style={{ opacity: canUndo ? 1 : 0.4 }}
            >
              ↶
            </button>
            <button
              className="btn-ghost px-2 py-1 text-sm"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              style={{ opacity: canRedo ? 1 : 0.4 }}
            >
              ↷
            </button>
          </div>

          <button
            className="btn"
            onClick={toggleTheme}
            title={`Switch to ${state.theme === "dark" ? "light" : "dark"} theme`}
          >
            {state.theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
