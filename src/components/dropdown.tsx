"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cx } from "@/lib/format";

export interface DropdownOption {
  value: string;
  label: string;
  /** Shown as a small badge on the right. */
  count?: number;
  icon?: React.ReactNode;
}

export interface DropdownGroup {
  label?: string;
  icon?: React.ReactNode;
  options: DropdownOption[];
}

export interface DropdownProps {
  id: string;
  label: string;
  labelIcon?: React.ReactNode;
  value: string;
  /** The "no filter" choice, always listed first, e.g. { value: "", label: "Any" }. */
  anyOption: DropdownOption;
  groups: DropdownGroup[];
  /** Adds a search box at the top of the list. */
  searchable?: boolean;
  searchPlaceholder?: string;
  onChange: (value: string) => void;
}

/**
 * A select that can be styled: a button that opens a list. Keyboard: arrows
 * move, Enter or Space picks, Escape closes, Home/End jump, typing a letter
 * jumps to the next option starting with it (or filters, when searchable).
 * Built on the listbox pattern so screen readers announce it like a select.
 */
export function Dropdown({ id, label, labelIcon, value, anyOption, groups, searchable, searchPlaceholder = "Search…", onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Filtered groups, and one flat list of options in display order for the keyboard.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (o: DropdownOption) => !q || o.label.toLowerCase().includes(q);
    const gs = groups.map((g) => ({ ...g, options: g.options.filter(match) })).filter((g) => g.options.length > 0);
    const flat = [...(match(anyOption) ? [anyOption] : []), ...gs.flatMap((g) => g.options)];
    return { groups: gs, flat, showAny: match(anyOption) };
  }, [groups, anyOption, query]);

  const all = useMemo(() => [anyOption, ...groups.flatMap((g) => g.options)], [anyOption, groups]);
  const selected = all.find((o) => o.value === value) ?? anyOption;

  function openList() {
    const idx = shown.flat.findIndex((o) => o.value === value);
    setQuery("");
    setActive(Math.max(0, idx));
    setOpen(true);
  }

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function pick(v: string) {
    close();
    if (v !== value) onChange(v);
  }

  // Focus the search box (or the list) when it opens; close on a click outside.
  useEffect(() => {
    if (!open) return;
    (searchable ? searchRef.current : listRef.current)?.focus();
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, searchable]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onListKey(e: React.KeyboardEvent) {
    const n = shown.flat.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (n ? (a + 1) % n : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (n ? (a - 1 + n) % n : 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, n - 1));
    } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
      e.preventDefault();
      const o = shown.flat[active];
      if (o) pick(o.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (!searchable && e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      const next = shown.flat.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(k));
      const wrap = shown.flat.findIndex((o) => o.label.toLowerCase().startsWith(k));
      const to = next >= 0 ? next : wrap;
      if (to >= 0) setActive(to);
    }
  }

  // One click handler for the whole list: the option clicked says which it is.
  function onListClick(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!el) return;
    const o = shown.flat[Number(el.dataset.index)];
    if (o) pick(o.value);
  }

  function onButtonKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
    }
  }

  const positions = new Map(shown.flat.map((o, i) => [o, i] as const));
  const renderOption = (o: DropdownOption) => {
    const i = positions.get(o) ?? 0;
    const isSel = o.value === value;
    const isActive = i === active;
    return (
      <div
        key={`${o.value}-${i}`}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={isSel}
        data-index={i}
        onMouseEnter={() => setActive(i)}
        onMouseDown={(e) => e.preventDefault()}
        className={cx(
          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
          isActive ? "bg-emerald-50 text-emerald-950" : "text-stone-700",
          isSel && "font-semibold",
        )}
      >
        <span className={cx("grid size-5 shrink-0 place-items-center", isActive || isSel ? "text-emerald-700" : "text-stone-400")}>{o.icon}</span>
        <span className="min-w-0 flex-1 truncate">{o.label}</span>
        {typeof o.count === "number" && (
          <span
            className={cx(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              o.count === 0 ? "bg-stone-100 text-stone-400" : isActive || isSel ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600",
            )}
          >
            {o.count.toLocaleString()}
          </span>
        )}
        <Check className={cx("size-4 shrink-0 text-emerald-700", isSel ? "opacity-100" : "opacity-0")} aria-hidden />
      </div>
    );
  };

  return (
    <div ref={rootRef} className="relative grid min-w-0 gap-1.5">
      <span id={`${id}-label`} className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
        {labelIcon}
        {label}
      </span>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${id}-label ${id}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onButtonKey}
        className={cx(
          "flex h-10 w-full items-center gap-2 rounded-xl bg-white pl-3 pr-2.5 text-left text-sm shadow-sm ring-1 transition",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700",
          open ? "ring-emerald-600" : "ring-stone-200 hover:ring-stone-300",
          value ? "text-stone-900" : "text-stone-500",
        )}
      >
        {selected.icon && <span className={cx("grid size-4 shrink-0 place-items-center", value ? "text-emerald-700" : "text-stone-400")}>{selected.icon}</span>}
        <span className={cx("min-w-0 flex-1 truncate", value && "font-medium")}>{selected.label}</span>
        {value && typeof selected.count === "number" && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-800">{selected.count.toLocaleString()}</span>
        )}
        <ChevronDown className={cx("size-4 shrink-0 text-stone-400 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-64 origin-top animate-[dropdown-in_140ms_ease-out] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-stone-200 motion-reduce:animate-none">
          {searchable && (
            <div className="flex items-center gap-2 border-b border-stone-100 px-3">
              <Search className="size-4 shrink-0 text-stone-400" aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                placeholder={searchPlaceholder}
                aria-label={`Search ${label.toLowerCase()}`}
                aria-controls={listId}
                aria-activedescendant={shown.flat.length ? `${listId}-${active}` : undefined}
                className="h-10 w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>
          )}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={`${id}-label`}
            tabIndex={searchable ? -1 : 0}
            aria-activedescendant={!searchable && shown.flat.length ? `${listId}-${active}` : undefined}
            onKeyDown={searchable ? undefined : onListKey}
            onClick={onListClick}
            className="max-h-72 overflow-y-auto overscroll-contain p-1.5 outline-none"
          >
            {shown.showAny && renderOption(anyOption)}
            {shown.groups.map((g, gi) => (
              <div key={g.label ?? gi} role="group" aria-label={g.label}>
                {g.label && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    {g.icon}
                    {g.label}
                  </div>
                )}
                {g.options.map(renderOption)}
              </div>
            ))}
            {shown.flat.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone-500">No matches for &ldquo;{query}&rdquo;</p>}
          </div>
        </div>
      )}
    </div>
  );
}
