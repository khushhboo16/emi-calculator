export const LOAN_BOUNDS = {
  amount: { min: 10_000, max: 50_00_000, step: 10_000 },
  rate: { min: 1, max: 36, step: 0.1 },
  tenure: { min: 1, max: 84, step: 1 },
} as const;

export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** Monthly rate (decimal) from annual percentage. */
export const monthlyRate = (annualPct: number) => annualPct / 12 / 100;

/**
 * Standard reducing-balance EMI.
 *
 *        P × r × (1+r)^n
 *  EMI = ───────────────
 *         (1+r)^n − 1
 */
export function calcEMI(principal: number, annualPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = monthlyRate(annualPct);
  if (r === 0) return principal / months; // 0% APR edge case
  const pow = Math.pow(1 + r, months);
  return (principal * r * pow) / (pow - 1);
}

export interface LoanSummary {
  emi: number;
  totalPayable: number;
  totalInterest: number;
  principalSharePct: number;
  interestSharePct: number;
}

export function calcSummary(
  principal: number,
  annualPct: number,
  months: number
): LoanSummary {
  const emi = calcEMI(principal, annualPct, months);
  const totalPayable = emi * months;
  const totalInterest = Math.max(0, totalPayable - principal);
  const principalSharePct = totalPayable > 0 ? (principal / totalPayable) * 100 : 0;
  const interestSharePct = totalPayable > 0 ? (totalInterest / totalPayable) * 100 : 0;
  return { emi, totalPayable, totalInterest, principalSharePct, interestSharePct };
}

export interface AmortRow {
  month: number;
  emi: number;
  principalPaid: number;
  interestPaid: number;
  balance: number;
  prepayment: number;
  /** cumulative principal repaid through this month */
  cumulativePrincipal: number;
  /** cumulative interest paid through this month */
  cumulativeInterest: number;
}

export interface Prepayment {
  id: string;
  month: number;
  amount: number;
}

export interface AmortResult {
  rows: AmortRow[];
  /** month index (1-based) where cumulative principal first ≥ cumulative interest; -1 if never */
  breakEvenMonth: number;
  totalInterest: number;
  totalPrincipal: number;
  /** actual tenure in months — may be shorter than the input if prepayments cleared the loan early */
  actualMonths: number;
}

/**
 * Builds the month-by-month schedule. Prepayments are applied at the start of
 * their month (before interest is charged), per the assignment spec.
 * Multiple prepayments in the same month are summed.
 */
export function buildSchedule(
  principal: number,
  annualPct: number,
  months: number,
  prepayments: Prepayment[] = []
): AmortResult {
  const rows: AmortRow[] = [];
  if (principal <= 0 || months <= 0) {
    return { rows, breakEvenMonth: -1, totalInterest: 0, totalPrincipal: 0, actualMonths: 0 };
  }

  const r = monthlyRate(annualPct);
  const emi = calcEMI(principal, annualPct, months);

  // index prepayments by month for O(1) lookup
  const prepayByMonth = new Map<number, number>();
  for (const p of prepayments) {
    if (p.amount > 0 && p.month >= 1) {
      prepayByMonth.set(p.month, (prepayByMonth.get(p.month) ?? 0) + p.amount);
    }
  }

  let balance = principal;
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;
  let breakEvenMonth = -1;

  // a safety cap — prepayment could in theory leave balance >0 longer than tenure
  // if rate is exotic, but practically the loop always terminates by `months`.
  const maxIter = months + 12;

  for (let m = 1; m <= maxIter && balance > 0.01; m++) {
    // apply prepayment at start of month (capped to balance)
    let prepay = prepayByMonth.get(m) ?? 0;
    if (prepay > balance) prepay = balance;
    balance -= prepay;
    cumulativePrincipal += prepay;

    if (balance <= 0.01) {
      rows.push({
        month: m,
        emi: 0,
        principalPaid: prepay,
        interestPaid: 0,
        balance: 0,
        prepayment: prepay,
        cumulativePrincipal,
        cumulativeInterest,
      });
      break;
    }

    const interestPaid = balance * r;
    // last-month adjustment: never pay more than what's owed
    let principalPaid = emi - interestPaid;
    let appliedEmi = emi;
    if (principalPaid > balance) {
      principalPaid = balance;
      appliedEmi = principalPaid + interestPaid;
    }

    balance -= principalPaid;
    cumulativePrincipal += principalPaid;
    cumulativeInterest += interestPaid;

    if (breakEvenMonth === -1 && cumulativePrincipal >= cumulativeInterest) {
      breakEvenMonth = m;
    }

    rows.push({
      month: m,
      emi: appliedEmi,
      principalPaid,
      interestPaid,
      balance: Math.max(0, balance),
      prepayment: prepay,
      cumulativePrincipal,
      cumulativeInterest,
    });
  }

  return {
    rows,
    breakEvenMonth,
    totalInterest: cumulativeInterest,
    totalPrincipal: cumulativePrincipal,
    actualMonths: rows.length,
  };
}

/** Builds the 7×7 sensitivity grid — rate offsets along columns, tenure offsets along rows. */
export interface SensitivityCell {
  rate: number;
  tenure: number;
  emi: number;
  isCenter: boolean;
}
export interface SensitivityGrid {
  rates: number[];   // column headers (unique, sorted ascending)
  tenures: number[]; // row headers (unique, sorted ascending)
  cells: SensitivityCell[][]; // cells[rowIdx][colIdx]
}

const RATE_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
const TENURE_OFFSETS = [-24, -12, -6, 0, 6, 12, 24];

export function buildSensitivity(
  principal: number,
  rate: number,
  tenure: number
): SensitivityGrid {
  // clamp + dedupe rates
  const rateSet = new Set<number>();
  for (const off of RATE_OFFSETS) {
    const r = +clamp(rate + off, LOAN_BOUNDS.rate.min, LOAN_BOUNDS.rate.max).toFixed(2);
    rateSet.add(r);
  }
  const rates = Array.from(rateSet).sort((a, b) => a - b);

  // clamp + dedupe tenures
  const tenureSet = new Set<number>();
  for (const off of TENURE_OFFSETS) {
    const t = Math.round(clamp(tenure + off, LOAN_BOUNDS.tenure.min, LOAN_BOUNDS.tenure.max));
    tenureSet.add(t);
  }
  const tenures = Array.from(tenureSet).sort((a, b) => a - b);

  const centerRate = +clamp(rate, LOAN_BOUNDS.rate.min, LOAN_BOUNDS.rate.max).toFixed(2);
  const centerTenure = Math.round(clamp(tenure, LOAN_BOUNDS.tenure.min, LOAN_BOUNDS.tenure.max));

  const cells: SensitivityCell[][] = tenures.map((t) =>
    rates.map((r) => ({
      rate: r,
      tenure: t,
      emi: calcEMI(principal, r, t),
      isCenter: r === centerRate && t === centerTenure,
    }))
  );

  return { rates, tenures, cells };
}

/* ---------- formatting ---------- */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_PRECISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const COMPACT = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const fmtINR = (n: number) => (Number.isFinite(n) ? INR.format(n) : "—");
export const fmtINRPrecise = (n: number) =>
  Number.isFinite(n) ? INR_PRECISE.format(n) : "—";
export const fmtCompact = (n: number) => (Number.isFinite(n) ? `₹${COMPACT.format(n)}` : "—");
