"use client";

import { useEffect, useState } from "react";
import { clamp } from "@/lib/finance";

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  /** how to format the value when displaying it in the number input */
  format?: (n: number) => string;
  /** how to format min/max tick labels */
  tickFormat?: (n: number) => string;
  suffix?: string;
  prefix?: string;
}

/**
 * Slider + number input that stay in sync. The number input has a local string
 * draft so the user can type freely; commit on blur / Enter; clamp on commit.
 */
export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  tickFormat,
  suffix,
  prefix,
}: SliderInputProps) {
  const [draft, setDraft] = useState<string>(() =>
    format ? format(value) : String(value)
  );
  const [focused, setFocused] = useState(false);

  // keep the input in sync when value changes from outside (other tab, slider, etc.)
  useEffect(() => {
    if (!focused) {
      setDraft(format ? format(value) : String(value));
    }
  }, [value, focused, format]);

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n)) {
      setDraft(format ? format(value) : String(value));
      return;
    }
    const clamped = clamp(n, min, max);
    onChange(clamped);
    setDraft(format ? format(clamped) : String(clamped));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-text">{label}</label>
        <div className="flex items-center gap-1 bg-surface-2 rounded-lg px-2 py-1 border border-border focus-within:border-accent transition-colors">
          {prefix && <span className="text-xs text-muted">{prefix}</span>}
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="bg-transparent outline-none text-sm font-semibold w-24 text-right tabular-nums text-text"
          />
          {suffix && <span className="text-xs text-muted">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between text-[11px] text-muted tabular-nums">
        <span>{tickFormat ? tickFormat(min) : min}</span>
        <span>{tickFormat ? tickFormat(max) : max}</span>
      </div>
    </div>
  );
}
