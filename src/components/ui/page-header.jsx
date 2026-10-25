import * as React from "react"
import { cn } from "../../lib/utils"

// Page title row: title (+ optional subtitle) at the start, actions at the end.
export function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
