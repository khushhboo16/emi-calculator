"use client";

import { fmtINR, LoanSummary } from "@/lib/finance";

interface Props {
  summary: LoanSummary;
  principal: number;
  tenure: number;
  /** show actual paid-off tenure when prepayments shorten it */
  actualMonths?: number;
}

export function SummaryCards({ summary, principal, tenure, actualMonths }: Props) {
  const { emi, totalInterest, totalPayable, principalSharePct, interestSharePct } = summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card label="Monthly EMI" value={fmtINR(emi)} accent />
        <Card label="Total Interest" value={fmtINR(totalInterest)} />
        <Card label="Total Payable" value={fmtINR(totalPayable)} />
      </div>

      {/* principal vs interest bar */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="uppercase tracking-wider font-semibold">Principal vs Interest</span>
          <span>
            {actualMonths && actualMonths !== tenure ? (
              <>
                <span className="text-text font-medium">{actualMonths}</span> of {tenure} months
              </>
            ) : (
              <>{tenure} months</>
            )}
          </span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-surface-2">
          <div
            className="bg-accent transition-all"
            style={{ width: `${principalSharePct}%` }}
            title={`Principal: ${principalSharePct.toFixed(1)}%`}
          />
          <div
            className="bg-warning transition-all"
            style={{ width: `${interestSharePct}%` }}
            title={`Interest: ${interestSharePct.toFixed(1)}%`}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-muted">Principal</span>
            <span className="text-text font-medium tabular-nums">{fmtINR(principal)}</span>
            <span className="text-muted">({principalSharePct.toFixed(1)}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-muted">Interest</span>
            <span className="text-text font-medium tabular-nums">{fmtINR(totalInterest)}</span>
            <span className="text-muted">({interestSharePct.toFixed(1)}%)</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? "border-accent/40 ring-1 ring-accent/20" : ""}`}>
      <div className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${accent ? "text-accent" : "text-text"}`}>
        {value}
      </div>
    </div>
  );
}
