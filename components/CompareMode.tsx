"use client";

import { useMemo } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { calcSummary, fmtINR, LOAN_BOUNDS } from "@/lib/finance";
import { Scenario } from "@/lib/workspace-state";
import { SliderInput } from "./SliderInput";

export function CompareMode() {
  const { state, setState } = useWorkspace();
  const scenarios = state.scenarios;

  const results = useMemo(
    () =>
      scenarios.map((s) => ({
        scenario: s,
        ...calcSummary(s.amount, s.rate, s.tenure),
      })),
    [scenarios]
  );

  const bestIdx = useMemo(() => {
    if (results.length === 0) return -1;
    let best = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i].totalPayable < results[best].totalPayable) best = i;
    }
    return best;
  }, [results]);

  const updateScenario = (id: string, patch: Partial<Scenario>) => {
    setState((p) => ({
      ...p,
      scenarios: p.scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const addScenario = () => {
    if (scenarios.length >= 3) return;
    const base = scenarios[scenarios.length - 1] ?? state.inputs;
    const label = `Scenario ${String.fromCharCode(65 + scenarios.length)}`;
    setState((p) => ({
      ...p,
      scenarios: [
        ...p.scenarios,
        {
          id: `s${Date.now().toString(36)}`,
          label,
          amount: base.amount,
          rate: base.rate,
          tenure: base.tenure,
        },
      ],
    }));
  };

  const removeScenario = (id: string) => {
    if (scenarios.length <= 1) return;
    setState((p) => ({ ...p, scenarios: p.scenarios.filter((s) => s.id !== id) }));
  };

  const useAsSingle = (s: Scenario) => {
    setState((p) => ({
      ...p,
      inputs: { amount: s.amount, rate: s.rate, tenure: s.tenure },
      mode: "single",
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Compare up to 3 loan scenarios side by side. The scenario with the lowest{" "}
          <span className="text-text font-medium">Total Payable</span> is highlighted.
        </p>
        {scenarios.length < 3 && (
          <button className="btn btn-primary" onClick={addScenario}>
            + Add scenario
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {results.map(({ scenario, emi, totalInterest, totalPayable }, i) => {
          const isBest = i === bestIdx;
          return (
            <div
              key={scenario.id}
              className={`card p-5 space-y-4 transition-all ${
                isBest ? "border-success ring-2 ring-success/30" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{scenario.label}</h3>
                  {isBest && (
                    <span className="chip" style={{ borderColor: "var(--success)", color: "var(--success)" }}>
                      ★ Lowest cost
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    className="btn-ghost text-xs px-2 py-1 text-muted hover:text-accent"
                    onClick={() => useAsSingle(scenario)}
                    title="Switch to single mode using these values"
                  >
                    Use →
                  </button>
                  {scenarios.length > 1 && (
                    <button
                      className="btn-ghost text-xs px-2 py-1 text-muted hover:text-danger"
                      onClick={() => removeScenario(scenario.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <SliderInput
                  label="Amount"
                  value={scenario.amount}
                  onChange={(n) => updateScenario(scenario.id, { amount: n })}
                  min={LOAN_BOUNDS.amount.min}
                  max={LOAN_BOUNDS.amount.max}
                  step={LOAN_BOUNDS.amount.step}
                  prefix="₹"
                  format={(n) => n.toLocaleString("en-IN")}
                />
                <SliderInput
                  label="Rate"
                  value={scenario.rate}
                  onChange={(n) => updateScenario(scenario.id, { rate: Math.round(n * 100) / 100 })}
                  min={LOAN_BOUNDS.rate.min}
                  max={LOAN_BOUNDS.rate.max}
                  step={LOAN_BOUNDS.rate.step}
                  suffix="%"
                  format={(n) => n.toFixed(2)}
                />
                <SliderInput
                  label="Tenure"
                  value={scenario.tenure}
                  onChange={(n) => updateScenario(scenario.id, { tenure: Math.round(n) })}
                  min={LOAN_BOUNDS.tenure.min}
                  max={LOAN_BOUNDS.tenure.max}
                  step={LOAN_BOUNDS.tenure.step}
                  suffix="mo"
                  format={(n) => String(Math.round(n))}
                />
              </div>

              <div className="pt-3 border-t border-border space-y-2">
                <Row label="Monthly EMI" value={fmtINR(emi)} strong accent={isBest} />
                <Row label="Total Interest" value={fmtINR(totalInterest)} />
                <Row label="Total Payable" value={fmtINR(totalPayable)} strong />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span
        className={`tabular-nums ${strong ? "font-bold" : "font-medium"} ${
          accent ? "text-success" : "text-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
