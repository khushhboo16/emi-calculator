"use client";

import { useMemo } from "react";
import { Header } from "./Header";
import { InputPanel } from "./InputPanel";
import { SummaryCards } from "./SummaryCards";
import { AmortizationView } from "./AmortizationView";
import { SensitivityGrid } from "./SensitivityGrid";
import { CompareMode } from "./CompareMode";
import { PrepaymentPlanner } from "./PrepaymentPlanner";
import { useWorkspace } from "./WorkspaceProvider";
import { buildSchedule, calcSummary } from "@/lib/finance";
import type { Mode } from "@/lib/workspace-state";
import { downloadAmortizationCsv } from "@/lib/csv";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "single", label: "Single Loan", hint: "One loan, full breakdown" },
  { id: "compare", label: "Compare Scenarios", hint: "Up to 3 side by side" },
  { id: "prepayment", label: "Prepayment Planner", hint: "Schedule lump-sum payments" },
];

export function EmiApp() {
  const { state, setState } = useWorkspace();
  const { inputs, mode, prepayments } = state;

  const setMode = (m: Mode) => setState((p) => ({ ...p, mode: m }));

  const summary = useMemo(
    () => calcSummary(inputs.amount, inputs.rate, inputs.tenure),
    [inputs.amount, inputs.rate, inputs.tenure]
  );

  const schedule = useMemo(
    () =>
      buildSchedule(
        inputs.amount,
        inputs.rate,
        inputs.tenure,
        mode === "prepayment" ? prepayments : []
      ),
    [inputs, prepayments, mode]
  );

  // recompute summary with prepayments applied for prepayment mode
  const displaySummary = useMemo(() => {
    if (mode !== "prepayment" || prepayments.length === 0) return summary;
    const totalPayable = schedule.totalPrincipal + schedule.totalInterest;
    return {
      ...summary,
      totalInterest: schedule.totalInterest,
      totalPayable,
      principalSharePct: totalPayable > 0 ? (schedule.totalPrincipal / totalPayable) * 100 : 0,
      interestSharePct: totalPayable > 0 ? (schedule.totalInterest / totalPayable) * 100 : 0,
    };
  }, [summary, schedule, mode, prepayments.length]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 w-full flex-1">
        {/* mode tabs */}
        <div className="flex flex-wrap gap-1 p-1 bg-surface-2 rounded-xl w-fit">
          {MODES.map((m) => (
            <button
              key={m.id}
              className="tab-pill"
              data-active={mode === m.id}
              onClick={() => setMode(m.id)}
              title={m.hint}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "single" && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            <InputPanel
              value={inputs}
              onChange={(next) => setState((p) => ({ ...p, inputs: next }))}
            />
            <div className="space-y-6">
              <SummaryCards summary={summary} principal={inputs.amount} tenure={inputs.tenure} />
              <SensitivityGrid
                principal={inputs.amount}
                rate={inputs.rate}
                tenure={inputs.tenure}
              />
            </div>
          </div>
        )}

        {mode === "compare" && <CompareMode />}

        {mode === "prepayment" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
              <InputPanel
                value={inputs}
                onChange={(next) => setState((p) => ({ ...p, inputs: next }))}
                title="Loan Inputs"
              />
              <SummaryCards
                summary={displaySummary}
                principal={inputs.amount}
                tenure={inputs.tenure}
                actualMonths={schedule.actualMonths}
              />
            </div>
            <PrepaymentPlanner />
          </div>
        )}

        {/* amortization always shown for single + prepayment */}
        {(mode === "single" || mode === "prepayment") && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                className="btn"
                onClick={() =>
                  downloadAmortizationCsv(schedule.rows, {
                    amount: inputs.amount,
                    rate: inputs.rate,
                    tenure: inputs.tenure,
                  })
                }
                disabled={schedule.rows.length === 0}
                title="Download schedule as CSV"
              >
                ↓ Export CSV
              </button>
            </div>
            <AmortizationView result={schedule} />
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-surface mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 text-xs text-muted flex items-center justify-between flex-wrap gap-2">
          <span>
            Cross-tab sync via <code className="font-mono text-text">BroadcastChannel</code>. Open
            in another tab to see real-time updates.
          </span>
          <span>Reducing-balance method · INR formatting (en-IN)</span>
        </div>
      </footer>
    </div>
  );
}
