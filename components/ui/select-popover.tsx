"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "./icons";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function SelectPopover({
  value,
  options,
  onChange,
  placeholder = "Pilih opsi",
  className = "",
  triggerClassName = "",
  compact = false,
  align = "left",
  disabled = false,
  ariaLabel,
}: {
  value: string;
  options: readonly SelectOption[] | SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  compact?: boolean;
  align?: "left" | "right";
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      className={`ui-select ${compact ? "ui-select--compact" : ""} ${open ? "ui-select--open" : ""} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        className={`ui-select__trigger ${triggerClassName}`.trim()}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ui-select__trigger-copy">
          <strong>{selected?.label ?? placeholder}</strong>
          {!compact && selected?.description ? <small>{selected.description}</small> : null}
        </span>
        <span className="ui-select__trigger-icon" aria-hidden="true">
          <ChevronDownIcon size={16} />
        </span>
      </button>

      {open ? (
        <div className={`ui-select__popover ui-select__popover--${align}`} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                type="button"
                key={option.value}
                className={`ui-select__option ${active ? "ui-select__option--active" : ""}`.trim()}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="ui-select__option-copy">
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
