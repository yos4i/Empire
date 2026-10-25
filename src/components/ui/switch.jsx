import * as React from "react"
import { cn } from "../../lib/utils"

export const Switch = React.forwardRef(({ checked, onCheckedChange, disabled, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onCheckedChange?.(!checked)}
    className={cn(
      "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
      checked ? "bg-success" : "bg-slate-300",
      className
    )}
    {...props}
  >
    <span
      className={cn(
        "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
        checked ? "-translate-x-6" : "-translate-x-1"
      )}
    />
  </button>
))
Switch.displayName = "Switch"
