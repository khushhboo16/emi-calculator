import type { Prepayment } from "./finance";

export type Mode = "single" | "compare" | "prepayment";
export type Theme = "light" | "dark";
export type View = "table" | "chart";

export interface LoanInputs {
  amount: number;
  rate: number;
  tenure: number;
}

export interface Scenario extends LoanInputs {
  id: string;
  label: string;
}

export interface WorkspaceState {
  inputs: LoanInputs;
  prepayments: Prepayment[];
  scenarios: Scenario[]; // compare-mode scenarios (1–3)
  mode: Mode;
  theme: Theme;
  view: View;
  /** monotonically increasing revision id — used to break feedback loops on broadcast */
  rev: number;
}

export const DEFAULT_INPUTS: LoanInputs = {
  amount: 15_00_000,
  rate: 11,
  tenure: 48,
};

export const DEFAULT_STATE: WorkspaceState = {
  inputs: { ...DEFAULT_INPUTS },
  prepayments: [],
  scenarios: [
    { id: "s1", label: "Scenario A", amount: 15_00_000, rate: 11, tenure: 24 },
    { id: "s2", label: "Scenario B", amount: 15_00_000, rate: 11, tenure: 48 },
    { id: "s3", label: "Scenario C", amount: 15_00_000, rate: 11, tenure: 60 },
  ],
  mode: "single",
  theme: "light",
  view: "table",
  rev: 0,
};

export const CHANNEL_NAME = "emi-workspace";
export const HEARTBEAT_INTERVAL_MS = 1500;
export const PRESENCE_TIMEOUT_MS = 4500;
export const UNDO_LIMIT = 50;

export type SyncMessage =
  | { kind: "state"; from: string; rev: number; state: WorkspaceState }
  | { kind: "hello"; from: string }
  | { kind: "heartbeat"; from: string; label: string; bornAt: number }
  | { kind: "bye"; from: string }
  | { kind: "state-request"; from: string }
  | { kind: "undo"; from: string }
  | { kind: "redo"; from: string };

/** Cheap tab-label generator: A, B, ... Z, AA, AB, ... — by birth order in this workspace */
export function tabLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

const URL_FIELDS = ["amount", "rate", "tenure", "mode"] as const;

export function encodeUrlState(s: WorkspaceState, base: URL): URL {
  const url = new URL(base.toString());
  url.searchParams.set("amount", String(s.inputs.amount));
  url.searchParams.set("rate", String(s.inputs.rate));
  url.searchParams.set("tenure", String(s.inputs.tenure));
  if (s.mode !== "single") url.searchParams.set("mode", s.mode);
  else url.searchParams.delete("mode");
  return url;
}

export function decodeUrlState(params: URLSearchParams): Partial<LoanInputs> & { mode?: Mode } {
  const out: Partial<LoanInputs> & { mode?: Mode } = {};
  const amount = Number(params.get("amount"));
  const rate = Number(params.get("rate"));
  const tenure = Number(params.get("tenure"));
  const mode = params.get("mode");
  if (Number.isFinite(amount) && amount > 0) out.amount = amount;
  if (Number.isFinite(rate) && rate > 0) out.rate = rate;
  if (Number.isFinite(tenure) && tenure > 0) out.tenure = Math.round(tenure);
  if (mode === "compare" || mode === "prepayment" || mode === "single") out.mode = mode;
  return out;
}

void URL_FIELDS; // keep for reference / future expansion
