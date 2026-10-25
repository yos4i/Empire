import * as React from "react"
import { cn } from "../../lib/utils"

// Simple segmented control: options = [{ value, label }]
export function Segmented({ options, value, onChange, className }) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-xl bg-muted p-1", className)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
