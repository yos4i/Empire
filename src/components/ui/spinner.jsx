import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

export function Spinner({ className }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-primary", className)} />
}

export function PageLoader({ label = "טוען..." }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner className="h-8 w-8" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/70", className)} />
}
