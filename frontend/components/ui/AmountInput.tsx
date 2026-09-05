"use client";

import { cn } from "@/lib/cn";

export function AmountInput({
  value,
  onChange,
  placeholder = "0.00",
  symbol = "cUSDC",
  disabled,
  onMax,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  symbol?: string;
  disabled?: boolean;
  onMax?: () => void;
  id?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="decimal"
        className={cn("input pr-24")}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, "");
          if ((v.match(/\./g) ?? []).length > 1) return;
          onChange(v);
        }}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-2">
        {onMax && (
          <button type="button" className="rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-faint" onClick={onMax} disabled={disabled}>
            MAX
          </button>
        )}
        <span className="text-sm text-ink-muted">{symbol}</span>
      </div>
    </div>
  );
}
