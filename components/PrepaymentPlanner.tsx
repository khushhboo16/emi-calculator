"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";
import { buildSchedule, calcSummary, fmtINR } from "@/lib/finance";
import type { Prepayment } from "@/lib/finance";

export function PrepaymentPlanner() {
  const { state, setState } = useWorkspace();
  const { inputs, prepayments } = state;

  const original = useMemo(
    () => calcSummary(inputs.amount, inputs.rate, inputs.tenure),
    [inputs.amount, inputs.rate, inputs.tenure]
  );
  const adjusted = useMemo(
    () => buildSchedule(inputs.amount, inputs.rate, inputs.tenure, prepayments),
    [inputs, prepayments]
  );

  const interestSaved = Math.max(0, original.totalInterest - adjusted.totalInterest);
  const monthsSaved = Math.max(0, inputs.tenure - adjusted.actualMonths);

  const [month, setMonth] = useState<string>("12");
  const [amount, setAmount] = useState<string>("100000");

  const addPrepayment = () => {
    const m = Number(month);
    const a = Number(amount);
    if (!Number.isFinite(m) || !Number.isFinite(a) || m < 1 || a <= 0) return;
    if (m > inputs.tenure) return;
    const next: Prepayment = {
      id: `p${Date.now().toString(36)}`,
      month: Math.round(m),
      amount: Math.round(a),
    };
    setState((p) => ({ ...p, prepayments: [...p.prepayments, next] }));
  };

  const removePrepayment = (id: string) => {
    setState((p) => ({ ...p, prepayments: p.prepayments.filter((x) => x.id !== id) }));
  };

  const sorted = [...prepayments].sort((a, b) => a.month - b.month);

  const monthInvalid = month !== "" && (Number(month) < 1 || Number(month) > inputs.tenure);
  const amountInvalid = amount !== "" && Number(amount) <= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* schedule prepayments */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Schedule Prepayments
          </h3>
          <p className="text-xs text-muted">
            Lump-sum payments are applied at the start of their month — they reduce the balance
            before that month's interest is charged. EMI stays fixed; the loan finishes sooner.
          </p>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted block mb-1">Month</label>
              <input
                type="number"
                min={1}
                max={inputs.tenure}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={`w-full bg-surface-2 rounded-lg px-3 py-2 text-sm tabular-nums border border-border focus:outline-none focus:border-accent ${
                  monthInvalid ? "border-danger" : ""
                }`}
              />
            </div>
            <div className="flex-[2]">
              <label className="text-xs text-muted block mb-1">Amount (₹)</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full bg-surface-2 rounded-lg px-3 py-2 text-sm tabular-nums border border-border focus:outline-none focus:border-accent ${
                  amountInvalid ? "border-danger" : ""
                }`}
              />
            </div>
            <button className="btn btn-primary" onClick={addPrepayment}>
              Add
            </button>
          </div>
          {monthInvalid && (
            <p className="text-xs text-danger">Month must be between 1 and {inputs.tenure}.</p>
          )}

          {sorted.length === 0 ? (
            <p className="text-sm text-muted italic py-3 text-center">No prepayments scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-2 text-sm"
                >
                  <span>
                    Month <span className="font-semibold tabular-nums">{p.month}</span> →{" "}
                    <span className="font-semibold tabular-nums">{fmtINR(p.amount)}</span>
                  </span>
                  <button
                    className="text-muted hover:text-danger text-xs"
                    onClick={() => removePrepayment(p.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* savings */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Savings vs Original Plan
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Interest Saved"
              value={fmtINR(interestSaved)}
              accent="success"
            />
            <Stat
              label="Tenure Reduced"
              value={`${monthsSaved} months`}
              accent="success"
            />
            <Stat label="Original Tenure" value={`${inputs.tenure} months`} />
            <Stat label="New Tenure" value={`${adjusted.actualMonths} months`} />
            <Stat label="Original Interest" value={fmtINR(original.totalInterest)} />
            <Stat label="New Interest" value={fmtINR(adjusted.totalInterest)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success";
}) {
  return (
    <div className="bg-surface-2 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted font-medium">{label}</div>
      <div
        className={`mt-1 text-base font-bold tabular-nums ${
          accent === "success" ? "text-success" : "text-text"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
