"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CHANNEL_NAME,
  DEFAULT_STATE,
  HEARTBEAT_INTERVAL_MS,
  PRESENCE_TIMEOUT_MS,
  UNDO_LIMIT,
  WorkspaceState,
  SyncMessage,
  decodeUrlState,
  encodeUrlState,
  tabLetter,
} from "@/lib/workspace-state";

interface PresenceEntry {
  id: string;
  label: string;
  bornAt: number;
  lastSeen: number;
}

interface WorkspaceCtx {
  state: WorkspaceState;
  setState: (updater: (prev: WorkspaceState) => WorkspaceState, opts?: { skipHistory?: boolean }) => void;
  // tab identity / presence
  tabId: string;
  tabLabel: string;
  activeTabs: PresenceEntry[];
  isLeader: boolean;
  // undo / redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Reads the persisted tab id from sessionStorage so reloads keep their identity.
 * Each *new* tab gets a fresh id (sessionStorage isn't shared across tabs).
 */
function getOrCreateTabId(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "emi:tabId";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = randomId();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

function bornAtForThisTab(): number {
  if (typeof window === "undefined") return 0;
  const KEY = "emi:bornAt";
  const existing = sessionStorage.getItem(KEY);
  if (existing) return Number(existing);
  const now = Date.now();
  sessionStorage.setItem(KEY, String(now));
  return now;
}

/** Sort presence entries deterministically so all tabs agree on the leader and on letter assignments. */
function sortPresence(entries: PresenceEntry[]): PresenceEntry[] {
  return [...entries].sort((a, b) => a.bornAt - b.bornAt || a.id.localeCompare(b.id));
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  // ---------- tab identity ----------
  const [tabId] = useState<string>(getOrCreateTabId);
  const [bornAt] = useState<number>(bornAtForThisTab);

  // ---------- core state ----------
  // Start with defaults on both server and client to avoid hydration mismatch.
  // URL params + saved theme are applied after mount.
  const [state, _setState] = useState<WorkspaceState>(DEFAULT_STATE);
  const [mounted, setMounted] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  // hydrate from URL + localStorage after mount
  useEffect(() => {
    let initial: WorkspaceState = stateRef.current;
    const urlPatch = decodeUrlState(new URLSearchParams(window.location.search));
    initial = {
      ...initial,
      inputs: { ...initial.inputs, ...urlPatch },
    };
    if (urlPatch.mode) initial = { ...initial, mode: urlPatch.mode };
    try {
      const savedTheme = localStorage.getItem("emi:theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        initial = { ...initial, theme: savedTheme };
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        initial = { ...initial, theme: "dark" };
      }
    } catch {
      /* ignore */
    }
    _setState(initial);
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- undo / redo ----------
  const pastRef = useRef<WorkspaceState[]>([]);
  const futureRef = useRef<WorkspaceState[]>([]);
  const [historyCounts, setHistoryCounts] = useState({ past: 0, future: 0 });

  // ---------- channel ----------
  const channelRef = useRef<BroadcastChannel | null>(null);

  // ---------- presence ----------
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceEntry>>(new Map());

  const broadcast = useCallback((msg: SyncMessage) => {
    const ch = channelRef.current;
    if (!ch) return;
    try {
      ch.postMessage(msg);
    } catch (err) {
      console.warn("[emi] broadcast failed:", err);
    }
  }, []);

  /** Applies a state update locally and broadcasts. Pushes the previous state onto undo history. */
  const setState = useCallback<WorkspaceCtx["setState"]>((updater, opts) => {
    const prev = stateRef.current;
    const next = updater(prev);
    if (next === prev) return;
    const withRev: WorkspaceState = { ...next, rev: prev.rev + 1 };
    if (!opts?.skipHistory) {
      pastRef.current.push(prev);
      if (pastRef.current.length > UNDO_LIMIT) pastRef.current.shift();
      futureRef.current = [];
      setHistoryCounts({ past: pastRef.current.length, future: 0 });
    }
    _setState(withRev);
    broadcast({ kind: "state", from: tabId, rev: withRev.rev, state: withRev });
  }, [broadcast, tabId]);

  /** Applies a snapshot received from another tab — no history push, no rebroadcast. */
  const applyRemoteState = useCallback((s: WorkspaceState) => {
    _setState(s);
    pastRef.current = [];
    futureRef.current = [];
    setHistoryCounts({ past: 0, future: 0 });
  }, []);

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(stateRef.current);
    setHistoryCounts({ past: pastRef.current.length, future: futureRef.current.length });
    const restored: WorkspaceState = { ...prev, rev: stateRef.current.rev + 1 };
    _setState(restored);
    broadcast({ kind: "state", from: tabId, rev: restored.rev, state: restored });
  }, [broadcast, tabId]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(stateRef.current);
    setHistoryCounts({ past: pastRef.current.length, future: futureRef.current.length });
    const restored: WorkspaceState = { ...next, rev: stateRef.current.rev + 1 };
    _setState(restored);
    broadcast({ kind: "state", from: tabId, rev: restored.rev, state: restored });
  }, [broadcast, tabId]);

  // ---------- setup channel + presence ----------
  useEffect(() => {
    if (typeof window === "undefined") return;

    // BroadcastChannel needs iOS 15.4+ / modern Chromium / FF — fall back gracefully
    // on older browsers so the calculator still works (just without cross-tab sync).
    let ch: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        ch = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = ch;
      } catch (err) {
        console.warn("[emi] BroadcastChannel unavailable — cross-tab sync disabled.", err);
        channelRef.current = null;
      }
    } else {
      console.warn("[emi] BroadcastChannel API not supported in this browser — cross-tab sync disabled.");
    }

    // local presence entry for self
    setPresenceMap((m) => {
      const next = new Map(m);
      next.set(tabId, { id: tabId, label: "?", bornAt, lastSeen: Date.now() });
      return next;
    });

    if (!ch) {
      // no channel — skip heartbeats; user still sees a working single-tab calculator
      return;
    }

    ch.onmessage = (ev: MessageEvent<SyncMessage>) => {
      const msg = ev.data;
      if (!msg || msg.from === tabId) return;

      switch (msg.kind) {
        case "state": {
          // accept only if its revision is newer
          if (msg.rev <= stateRef.current.rev) return;
          applyRemoteState(msg.state);
          break;
        }
        case "hello": {
          // someone new — answer with our heartbeat and (if we're the leader) push state
          broadcast({
            kind: "heartbeat",
            from: tabId,
            label: tabId,
            bornAt,
          });
          // leader check happens in a separate effect; we send state from there.
          break;
        }
        case "heartbeat": {
          setPresenceMap((prev) => {
            const next = new Map(prev);
            const existing = next.get(msg.from);
            next.set(msg.from, {
              id: msg.from,
              label: existing?.label ?? "?",
              bornAt: msg.bornAt,
              lastSeen: Date.now(),
            });
            return next;
          });
          break;
        }
        case "bye": {
          setPresenceMap((prev) => {
            if (!prev.has(msg.from)) return prev;
            const next = new Map(prev);
            next.delete(msg.from);
            return next;
          });
          break;
        }
        case "state-request": {
          // only the leader responds
          break;
        }
        case "undo":
          undo();
          break;
        case "redo":
          redo();
          break;
      }
    };

    // initial handshake
    broadcast({ kind: "hello", from: tabId });
    broadcast({ kind: "heartbeat", from: tabId, label: tabId, bornAt });
    broadcast({ kind: "state-request", from: tabId });

    const heartbeat = setInterval(() => {
      broadcast({ kind: "heartbeat", from: tabId, label: tabId, bornAt });
      // sweep stale presence
      setPresenceMap((prev) => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [id, entry] of next) {
          if (id === tabId) {
            next.set(id, { ...entry, lastSeen: now });
            continue;
          }
          if (now - entry.lastSeen > PRESENCE_TIMEOUT_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, HEARTBEAT_INTERVAL_MS);

    const onUnload = () => {
      broadcast({ kind: "bye", from: tabId });
      ch.close();
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      broadcast({ kind: "bye", from: tabId });
      ch.close();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, bornAt]);

  // ---------- leader: respond to state requests ----------
  const presenceList = useMemo(() => sortPresence([...presenceMap.values()]), [presenceMap]);
  const leader = presenceList[0];
  const isLeader = leader?.id === tabId;

  // assign stable letter labels (A,B,...) based on birth order
  const labeledPresence = useMemo<PresenceEntry[]>(
    () => presenceList.map((p, i) => ({ ...p, label: tabLetter(i) })),
    [presenceList]
  );
  const myLabel = useMemo(
    () => labeledPresence.find((p) => p.id === tabId)?.label ?? "?",
    [labeledPresence, tabId]
  );

  // when we become leader, answer any pending state-request messages
  useEffect(() => {
    if (!isLeader) return;
    const ch = channelRef.current;
    if (!ch) return;
    const onMsg = (ev: MessageEvent<SyncMessage>) => {
      const msg = ev.data;
      if (msg.from === tabId) return;
      if (msg.kind === "state-request") {
        broadcast({
          kind: "state",
          from: tabId,
          rev: stateRef.current.rev,
          state: stateRef.current,
        });
      }
    };
    ch.addEventListener("message", onMsg);
    return () => ch.removeEventListener("message", onMsg);
  }, [isLeader, broadcast, tabId]);

  // ---------- side effects ----------
  // dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dark");
    try {
      localStorage.setItem("emi:theme", state.theme);
    } catch {
      /* ignore */
    }
  }, [state.theme]);

  // URL state — keep the inputs and mode shareable
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = encodeUrlState(state, new URL(window.location.href));
    if (url.toString() !== window.location.href) {
      window.history.replaceState(null, "", url.toString());
    }
  }, [state.inputs, state.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard shortcuts: Ctrl/Cmd+Z for undo, Shift+Ctrl/Cmd+Z for redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const value: WorkspaceCtx = {
    state,
    setState,
    tabId,
    tabLabel: myLabel,
    activeTabs: labeledPresence,
    isLeader,
    undo,
    redo,
    canUndo: historyCounts.past > 0,
    canRedo: historyCounts.future > 0,
  };

  return (
    <Ctx.Provider value={value}>
      {mounted ? (
        children
      ) : (
        <div className="min-h-screen grid place-items-center text-muted text-sm">
          Loading workspace…
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
