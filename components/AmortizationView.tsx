"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AmortResult, AmortRow, fmtINR } from "@/lib/finance";
import { useWorkspace } from "./WorkspaceProvider";

const ROWS_PER_PAGE = 12;

interface Props {
  result: AmortResult;
}

export function AmortizationView({ result }: Props) {
  const { state, setState } = useWorkspace();
  const view = state.view;
  const setView = (v: "table" | "chart") =>
    setState((p) => ({ ...p, view: v }), { skipHistory: true });

  const { rows, breakEvenMonth } = result;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Amortization Schedule
          </h2>
          {breakEvenMonth > 0 && (
            <p className="text-xs text-muted mt-1">
              Break-even month: <span className="text-accent font-semibold">{breakEvenMonth}</span>{" "}
              — principal repaid first exceeds interest paid.
            </p>
          )}
        </div>
        <div className="flex gap-1 p-1 bg-surface-2 rounded-lg">
          <button
            className="tab-pill"
            data-active={view === "table"}
            onClick={() => setView("table")}
          >
            Table
          </button>
          <button
            className="tab-pill"
            data-active={view === "chart"}
            onClick={() => setView("chart")}
          >
            Chart
          </button>
        </div>
      </div>
      {view === "table" ? (
        <AmortTable rows={rows} breakEvenMonth={breakEvenMonth} />
      ) : (
        <AmortChart rows={rows} breakEvenMonth={breakEvenMonth} />
      )}
    </div>
  );
}

function AmortTable({ rows, breakEvenMonth }: { rows: AmortRow[]; breakEvenMonth: number }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * ROWS_PER_PAGE;
  const visible = rows.slice(start, start + ROWS_PER_PAGE);

  // jump to break-even page on click
  const goToBreakEven = () => {
    if (breakEvenMonth < 1) return;
    setPage(Math.floor((breakEvenMonth - 1) / ROWS_PER_PAGE));
  };

  if (rows.length === 0) {
    return <div className="p-8 text-center text-muted text-sm">No schedule to display.</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="amort">
          <thead>
            <tr>
              <th>Month</th>
              <th>EMI</th>
              <th>Principal</th>
              <th>Interest</th>
              <th>Prepayment</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.month} className={r.month === breakEvenMonth ? "break-even" : ""}>
                <td className="tabular-nums">{r.month}</td>
                <td className="tabular-nums">{fmtINR(r.emi)}</td>
                <td className="tabular-nums">{fmtINR(r.principalPaid)}</td>
                <td className="tabular-nums">{fmtINR(r.interestPaid)}</td>
                <td className="tabular-nums text-muted">
                  {r.prepayment > 0 ? fmtINR(r.prepayment) : "—"}
                </td>
                <td className="tabular-nums font-medium">{fmtINR(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between p-3 border-t border-border text-sm">
        <div className="flex items-center gap-2 text-muted">
          <span>
            Showing {start + 1}–{Math.min(start + ROWS_PER_PAGE, rows.length)} of {rows.length}
          </span>
          {breakEvenMonth > 0 && (
            <button
              className="btn-ghost text-xs text-accent hover:underline px-2 py-1"
              onClick={goToBreakEven}
            >
              jump to break-even ★
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </button>
          <span className="px-3 text-sm tabular-nums">
            {safePage + 1} / {totalPages}
          </span>
          <button
            className="btn"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function AmortChart({ rows, breakEvenMonth }: { rows: AmortRow[]; breakEvenMonth: number }) {
  const data = useMemo(
    () =>
      rows.map((r) => ({
        month: r.month,
        Principal: Math.round(r.principalPaid),
        Interest: Math.round(r.interestPaid),
      })),
    [rows]
  );

  if (data.length === 0) {
    return <div className="p-8 text-center text-muted text-sm">No schedule to display.</div>;
  }

  return (
    <div className="p-4">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            stroke="var(--muted)"
            fontSize={11}
            tickFormatter={(v) => `M${v}`}
            interval={Math.max(0, Math.floor(data.length / 12) - 1)}
          />
          <YAxis
            stroke="var(--muted)"
            fontSize={11}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text)",
            }}
            formatter={(v: number) => fmtINR(v)}
            labelFormatter={(m) => `Month ${m}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Principal" stackId="emi" fill="var(--accent)">
            {data.map((d) => (
              <Cell
                key={d.month}
                stroke={d.month === breakEvenMonth ? "var(--success)" : undefined}
                strokeWidth={d.month === breakEvenMonth ? 2 : 0}
              />
            ))}
          </Bar>
          <Bar dataKey="Interest" stackId="emi" fill="var(--warning)" />
        </BarChart>
      </ResponsiveContainer>
      {breakEvenMonth > 0 && (
        <p className="text-xs text-muted text-center mt-2">
          ★ Bar at month {breakEvenMonth} is the break-even month.
        </p>
      )}
    </div>
  );
}
