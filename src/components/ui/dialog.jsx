import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

// Bottom sheet on phones, centered modal from sm and up.
// Radix gives us Esc-to-close, focus trap and body scroll lock.

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const sideClasses = {
  // default: sheet from bottom on mobile, centered on desktop
  auto:
    "inset-x-0 bottom-0 max-h-[90vh] rounded-t-3xl pb-safe data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom " +
    "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
  // side drawer (RTL: opens from the right / start edge)
  right:
    "inset-y-0 right-0 h-full w-full sm:w-[440px] data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
}

const DialogContent = React.forwardRef(
  ({ className, children, side = "auto", hideClose = false, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        dir="rtl"
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border bg-card text-right shadow-xl duration-200 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          sideClasses[side],
          side === "auto" && "sm:max-w-md",
          className
        )}
        {...props}
      >
        {side === "auto" && (
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" aria-hidden />
        )}
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute left-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-5 w-5" />
            <span className="sr-only">סגור</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
)
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }) => (
  <div className={cn("shrink-0 px-5 pb-2 pt-4 pl-14", className)} {...props} />
)

const DialogBody = ({ className, ...props }) => (
  <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3", className)} {...props} />
)

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn("flex shrink-0 flex-col-reverse gap-2 border-t bg-card px-5 py-3 sm:flex-row sm:justify-start", className)}
    {...props}
  />
)

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-bold leading-tight", className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
