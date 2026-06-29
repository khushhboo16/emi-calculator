# EMI Calculator — Shared Workspace

A Loan EMI calculator built with **Next.js 14 (App Router)** and **TypeScript** where calculator state is shared across browser tabs in real time. Change the loan amount in one tab and every other open tab updates instantly — no server, no polling, no `localStorage` event hacks. Powered by the `BroadcastChannel` API.

## Features

| # | Feature | Notes |
|---|---------|-------|
| 1 | **EMI Calculator** | Synced slider + number input for Amount, Rate, Tenure. Live monthly EMI, total interest, total payable, principal-vs-interest split bar. |
| 2 | **Amortization Schedule** | Paginated table (12 rows/page) and a stacked-bar chart toggle. Break-even month is highlighted in both views, with a one-click "jump to break-even" shortcut. |
| 3 | **Loan Comparison Mode** | Up to 3 scenarios side by side. The scenario with the lowest total payable is visually highlighted. "Use →" copies a scenario back into single mode. |
| 4 | **What-If Sensitivity Grid** | Read-only 7×7 grid of EMI values varying rate (±1, ±2, ±3 %) and tenure (±6, ±12, ±24 mo). Clamped to valid bounds and de-duplicated near edges. Center cell highlighted. |
| 5 | **Prepayment Planner** | Schedule any number of lump-sum prepayments. Reduce-tenure strategy. Shows interest saved and months saved vs the original plan. |
| 6 | **Cross-Tab Sync** | All state (inputs, scenarios, prepayments, mode, theme, table/chart toggle) syncs across tabs in real time via a single `BroadcastChannel`. |
| 7 | **Tab Identity & Presence** | Each tab gets a stable letter label (A, B, C…) based on birth order. Live count of active tabs via a heartbeat + presence map. Stale entries time out after 4.5s. |
| 8 | **Theme Sync** | Dark / light toggle that flows through the same channel — switch in one tab, all tabs flip together. |

### Bonus challenges implemented

- ✅ **Tab Leadership** — new tabs send a `state-request`; the oldest tab (lowest `bornAt`) is the leader and responds with the current state. If the leader closes, the next-oldest tab automatically becomes leader.
- ✅ **Undo Across Tabs** — `Ctrl/Cmd+Z` reverts the last change, and the rollback is broadcast as a normal state update so every tab reflects it.
- ✅ **CSV Export** — download the amortization schedule (including prepayments + cumulative columns).
- ✅ **URL State** — amount, rate, tenure, and mode are encoded in the query string so any scenario can be shared via link.

## Getting started

```bash
# install
npm install

# dev
npm run dev          # http://localhost:3000

# production
npm run build && npm start
```

Open the app, then open a second tab on the same URL — slide the loan amount in one and watch the other update.

## Tech stack

- **Next.js 14.2** App Router, **React 18.3** (hooks only)
- **TypeScript 5.5**
- **Tailwind CSS 3.4** with CSS variables for theming
- **Recharts** for the amortization chart
- No backend

## Project layout

```
app/
  layout.tsx        # root layout + inline theme bootstrap (no FOUC)
  page.tsx          # mounts <WorkspaceProvider><EmiApp /></WorkspaceProvider>
  globals.css       # CSS vars (light + dark), slider styling, card / btn / chip primitives
components/
  WorkspaceProvider.tsx   # shared-state context + BroadcastChannel + presence + undo
  Header.tsx              # tab id, active-tab count, undo/redo, theme toggle
  EmiApp.tsx              # mode router (single / compare / prepayment)
  InputPanel.tsx          # the 3 synced sliders
  SliderInput.tsx         # number-input + slider that stay in sync
  SummaryCards.tsx        # EMI / interest / total + principal-vs-interest bar
  AmortizationView.tsx    # paginated table + Recharts stacked bar chart
  CompareMode.tsx         # 3-scenario compare view
  PrepaymentPlanner.tsx   # schedule prepayments, savings vs original plan
  SensitivityGrid.tsx     # 7×7 rate × tenure EMI grid
lib/
  finance.ts        # EMI formula, amortization, sensitivity, INR formatters
  workspace-state.ts # shared-state types, defaults, URL codec, sync message types
  csv.ts            # amortization CSV download
```

## Math

All computations use the **reducing-balance** method (interest charged on the outstanding balance, the Indian retail-loan standard).

```
        P × r × (1+r)^n
  EMI = ───────────────         r = annual rate / 12 / 100
         (1+r)^n − 1            n = tenure in months
```

The amortization schedule iterates month by month, carrying balance forward. For prepayments, the lump sum is applied at the **start** of the prepayment's month (before interest is charged that month), then the same fixed EMI continues — the loan finishes earlier ("reduce tenure" strategy).

## Cross-tab sync — how it works

Everything goes through a single `BroadcastChannel("emi-workspace")` instance.

Message kinds:

| Kind | Sender | Receiver behavior |
|------|--------|-------------------|
| `state` | any tab on user change | replace local state if `rev` is newer; do not rebroadcast |
| `hello` | new tab on mount | recipients reply with a heartbeat |
| `heartbeat` | every tab every 1.5s | recipients record sender in their presence map |
| `bye` | tab on unload | recipients remove sender from presence map |
| `state-request` | new tab on mount | only the **leader** answers with the current `state` |
| `undo` / `redo` | reserved (currently undo broadcasts as a `state` message) | — |

**Presence map.** Every tab keeps a `Map<tabId, { bornAt, lastSeen }>`. Entries older than 4.5s are swept on each heartbeat. The active-tab count is `presence.size`.

**Leader election.** Tabs are sorted by `bornAt` (then by `tabId`); the first is the leader. Election is implicit — every tab reaches the same answer locally without any extra messages. If the leader closes, the next tab in the sorted order naturally becomes leader on the next sweep.

**Revisions break the loop.** Every state change increments `rev`. When a tab receives a `state` message with `rev ≤ local.rev`, it ignores it — that's how echo and out-of-order messages are filtered.

## Edge cases handled

- Loan amount or tenure of 0 → EMI = 0, schedule empty (no division by zero).
- 0 % rate → falls back to `principal / months` (the standard formula's `(1+r)^n − 1` denominator is 0).
- Prepayment > outstanding balance → clamped to balance; loan closes that month.
- Prepayment in a month beyond tenure → ignored (validated in the input).
- Multiple prepayments in the same month → summed.
- Sensitivity grid near bounds (e.g. tenure = 3) → −6/−12/−24 offsets all clamp to 1; duplicate axis values are collapsed.

## Keyboard shortcuts

- `Ctrl/Cmd+Z` — undo (cross-tab)
- `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` — redo (cross-tab)

## Deployment

This is a static-friendly Next.js app — `npm run build && npm start` works anywhere Node runs, and it deploys to Vercel with no configuration. To host it as a fully static export, add `output: "export"` to `next.config.mjs`.

## License

MIT — for evaluation purposes.
