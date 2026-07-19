import { Loader2, ShieldCheck, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatPackagePrice } from "@/lib/wallet-format"
import type { CoinPackage } from "@/types/wallet"

type PackageDetailsProps = {
  selected: CoinPackage | null
  isBestValue: boolean
  isLoading: boolean
  isCheckingOut: boolean
  onCheckout: () => void
  className?: string
}

export function PackageDetails({
  selected,
  isBestValue,
  isLoading,
  isCheckingOut,
  onCheckout,
  className,
}: PackageDetailsProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (!selected) {
    return (
      <div className={cn("space-y-1", className)}>
        <p className="text-sm font-medium text-foreground">Select a package</p>
        <p className="text-xs text-muted-foreground">
          Choose a coin pack to review pricing and checkout.
        </p>
      </div>
    )
  }

  const price = formatPackagePrice(selected.priceCents, selected.currency)
  const perCoin =
    selected.coins > 0
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: selected.currency.toUpperCase(),
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }).format(selected.priceCents / 100 / selected.coins)
      : null

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Selected plan
            </p>
            {isBestValue ? (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                Best value
              </Badge>
            ) : null}
          </div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {selected.name}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Instant credit after payment. Coins never expire.
          </p>
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            You get
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {selected.coins.toLocaleString()}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              coins
            </span>
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Price</span>
            <span className="font-medium tabular-nums text-foreground">
              {price}
            </span>
          </div>
          {perCoin ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Per coin</span>
              <span className="tabular-nums text-muted-foreground">{perCoin}</span>
            </div>
          ) : null}
        </div>

        <Separator />

        <ul className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
          <li className="flex items-start gap-2">
            <Zap className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Generate and enhance thumbnails right away
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Secure checkout powered by Stripe
          </li>
        </ul>
      </div>

      <div className="mt-auto shrink-0 space-y-2 border-t border-border/60 pt-4">
        <Button
          size="sm"
          className="h-9 w-full text-xs"
          disabled={isCheckingOut}
          onClick={onCheckout}
        >
          {isCheckingOut ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Redirecting…
            </>
          ) : (
            <>Get now — {price}</>
          )}
        </Button>
        <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
          You&apos;ll be redirected to Stripe to complete payment.
        </p>
      </div>
    </div>
  )
}
