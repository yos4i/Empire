import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

// Promise-based replacement for window.confirm:
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'למחוק?', confirmText: 'מחק', destructive: true }))) return;

const ConfirmContext = React.createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = React.useState(null)
  const resolverRef = React.useRef(null)

  const confirm = React.useCallback((options) => {
    const opts = typeof options === "string" ? { title: options } : options || {}
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setState(opts)
    })
  }, [])

  const close = (result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialogPrimitive.Root open={!!state} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <AlertDialogPrimitive.Content
            dir="rtl"
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-5 text-right shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <AlertDialogPrimitive.Title className="text-lg font-bold">
              {state?.title}
            </AlertDialogPrimitive.Title>
            {state?.description ? (
              <AlertDialogPrimitive.Description className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {state.description}
              </AlertDialogPrimitive.Description>
            ) : (
              <AlertDialogPrimitive.Description className="sr-only">{state?.title}</AlertDialogPrimitive.Description>
            )}
            <div className="mt-5 flex flex-row-reverse gap-2 sm:flex-row sm:justify-start">
              <AlertDialogPrimitive.Action
                onClick={() => close(true)}
                className={cn(
                  buttonVariants({ variant: state?.destructive ? "destructive" : "default" }),
                  "flex-1 sm:flex-none"
                )}
              >
                {state?.confirmText || "אישור"}
              </AlertDialogPrimitive.Action>
              <AlertDialogPrimitive.Cancel
                onClick={() => close(false)}
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 sm:flex-none")}
              >
                {state?.cancelText || "ביטול"}
              </AlertDialogPrimitive.Cancel>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>")
  return ctx
}
