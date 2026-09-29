import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
        // Non-destructive info/warning variant (design spec §2/§6.2/§7.2) —
        // the goal-derived pace-estimate banner. Same `bg-card` pattern as
        // `destructive` (a real error keeps a light surface too, per §2:
        // "no dark chrome anywhere"), colored with the accent family
        // (`--warning`, same hue as `--primary`) instead of red, so it
        // reads as "worth knowing," not "you made an error."
        //
        // Background is Tempo's `accent/tint-bg` (#FFF7ED, pale orange), and
        // the description keeps full-strength `--warning` (#C2410C) — NO
        // alpha modifier. Measured contrast of #C2410C on #FFF7ED is 4.88:1
        // (5.18:1 on white); a `/90` modifier drops it below the 4.5:1
        // required by plan-setup-flow.md §9 (4.42:1 on white).
        warning:
          "border-warning/30 bg-warning-tint text-warning *:data-[slot=alert-description]:text-warning [&>svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
