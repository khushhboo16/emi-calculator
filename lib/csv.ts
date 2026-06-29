import type { AmortRow } from "./finance";

interface Meta {
  amount: number;
  rate: number;
  tenure: number;
}

/** Build a CSV string and trigger a browser download. */
export function downloadAmortizationCsv(rows: AmortRow[], meta: Meta) {
  if (typeof window === "undefined" || rows.length === 0) return;
  const header = [
    "Month",
    "EMI",
    "Principal Paid",
    "Interest Paid",
    "Prepayment",
    "Balance",
    "Cumulative Principal",
    "Cumulative Interest",
  ];
  const data = rows.map((r) => [
    r.month,
    r.emi.toFixed(2),
    r.principalPaid.toFixed(2),
    r.interestPaid.toFixed(2),
    r.prepayment.toFixed(2),
    r.balance.toFixed(2),
    r.cumulativePrincipal.toFixed(2),
    r.cumulativeInterest.toFixed(2),
  ]);

  const preamble = [
    `# EMI Amortization Schedule`,
    `# Principal: ${meta.amount}`,
    `# Annual Rate: ${meta.rate}%`,
    `# Tenure: ${meta.tenure} months`,
    `# Generated: ${new Date().toISOString()}`,
  ].join("\n");

  const csv =
    preamble +
    "\n" +
    [header, ...data].map((row) => row.map(escapeCell).join(",")).join("\n") +
    "\n";

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `emi-schedule-${meta.amount}-${meta.rate}pct-${meta.tenure}mo.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCell(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
