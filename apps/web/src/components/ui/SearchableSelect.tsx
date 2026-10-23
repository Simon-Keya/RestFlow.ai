"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SelectOption } from "./Select";

export interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * Combobox-style select: search field is always visible in the open panel.
 * Does not use Radix Select (search inside Select is easy to miss / focus-hostile).
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  className,
  disabled,
  emptyMessage = "No matches",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = useMemo(
    () => options.find((o) => o.value === value && o.value !== ""),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = options.filter((o) => o.value !== "");
    if (!q) return list;
    return list.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      // Focus search as soon as the panel opens
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function pick(next: string) {
    onValueChange(next);
    setOpen(false);
    setQuery("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onValueChange("");
    setQuery("");
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-left text-sm text-ink",
          "focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-ink-faint",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="truncate">
          {selected?.label ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={clear}
              className="rounded p-0.5 text-ink-faint hover:bg-surface-muted hover:text-ink"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-ink-faint transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[200] overflow-hidden rounded-md border border-border bg-surface shadow-popover"
          role="listbox"
          id={listId}
        >
          {/* Search is always visible when open */}
          <div className="border-b border-border bg-surface-muted/40 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                  }
                  if (e.key === "Enter" && filtered[0]) {
                    e.preventDefault();
                    pick(filtered[0].value);
                  }
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                aria-label={searchPlaceholder}
              />
            </div>
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-muted">{emptyMessage}</li>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted",
                        active && "bg-primary-50",
                      )}
                      onClick={() => pick(opt.value)}
                    >
                      <span className="w-4 shrink-0">
                        {active ? (
                          <Check className="h-3.5 w-3.5 text-primary-600" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
