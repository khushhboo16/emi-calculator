"use client";

import { useMemo } from "react";
import { buildSensitivity, fmtINR, LOAN_BOUNDS } from "@/lib/finance";

interface Props {
  principal: number;
  rate: number;
  tenure: number;
}

export function SensitivityGrid({ principal, rate, tenure }: Props) {
  const grid = useMemo(() => buildSensitivity(principal, rate, tenure), [principal, rate, tenure]);
  const { rates, tenures, cells } = grid;

  const allEmis = cells.flatMap((row) => row.map((c) => c.emi));
  const lo = Math.min(...allEmis);
  const hi = Math.max(...allEmis);
  const heat = (v: number) => {
    if (hi === lo) return 0;
    return (v - lo) / (hi - lo); // 0..1
  };

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          What-If Sensitivity
        </h2>
        <p className="text-xs text-muted">
          EMI for rate × tenure variations (P = {fmtINR(principal)})
        </p>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-muted font-medium">
                <span className="flex flex-col">
                  <span>Tenure ↓</span>
                  <span>Rate →</span>
                </span>
              </th>
              {rates.map((r) => (
                <th key={r} className="p-2 text-right font-medium text-muted">
                  {r.toFixed(r % 1 === 0 ? 0 : 2)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenures.map((t, i) => (
              <tr key={t}>
                <td className="p-2 text-muted font-medium border-t border-border">{t}m</td>
                {cells[i].map((c) => {
                  const h = heat(c.emi);
                  // higher EMI = warmer color (interest pain)
                  const bg = `color-mix(in srgb, var(--warning) ${(h * 25).toFixed(1)}%, var(--surface))`;
                  return (
                    <td
                      key={`${c.rate}-${c.tenure}`}
                      className={`p-2 text-right tabular-nums border-t border-border ${
                        c.isCenter ? "font-bold ring-2 ring-accent" : ""
                      }`}
                      style={{ background: c.isCenter ? "var(--accent-soft)" : bg }}
                      title={`${fmtINR(c.emi)} @ ${c.rate}% × ${c.tenure}m`}
                    >
                      {fmtINR(c.emi)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted mt-3">
        Center cell (highlighted) matches your current inputs. Rates ranged 1–{LOAN_BOUNDS.rate.max}
        %, tenures 1–{LOAN_BOUNDS.tenure.max}m; duplicates collapsed at boundaries.
      </p>
    </div>
  );
}
