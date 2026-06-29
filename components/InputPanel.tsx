"use client";

import { SliderInput } from "./SliderInput";
import { LOAN_BOUNDS, fmtCompact } from "@/lib/finance";
import { LoanInputs } from "@/lib/workspace-state";

interface Props {
  value: LoanInputs;
  onChange: (next: LoanInputs) => void;
  title?: string;
}

export function InputPanel({ value, onChange, title = "Loan Inputs" }: Props) {
  return (
    <div className="card p-6 space-y-6">
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
        </div>
      )}
      <SliderInput
        label="Loan Amount"
        value={value.amount}
        onChange={(n) => onChange({ ...value, amount: n })}
        min={LOAN_BOUNDS.amount.min}
        max={LOAN_BOUNDS.amount.max}
        step={LOAN_BOUNDS.amount.step}
        prefix="₹"
        format={(n) => n.toLocaleString("en-IN")}
        tickFormat={fmtCompact}
      />
      <SliderInput
        label="Annual Interest Rate"
        value={value.rate}
        onChange={(n) => onChange({ ...value, rate: Math.round(n * 100) / 100 })}
        min={LOAN_BOUNDS.rate.min}
        max={LOAN_BOUNDS.rate.max}
        step={LOAN_BOUNDS.rate.step}
        suffix="% p.a."
        format={(n) => n.toFixed(2)}
        tickFormat={(n) => `${n}%`}
      />
      <SliderInput
        label="Tenure"
        value={value.tenure}
        onChange={(n) => onChange({ ...value, tenure: Math.round(n) })}
        min={LOAN_BOUNDS.tenure.min}
        max={LOAN_BOUNDS.tenure.max}
        step={LOAN_BOUNDS.tenure.step}
        suffix="months"
        format={(n) => String(Math.round(n))}
        tickFormat={(n) => `${n}m`}
      />
    </div>
  );
}
