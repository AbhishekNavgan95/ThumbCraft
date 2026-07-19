import { Check, Coins } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatPackagePrice } from "@/lib/wallet-format"
import type { CoinPackage } from "@/types/wallet"

type PackageListProps = {
  packages: CoinPackage[]
  selectedId: string | null
  bestValueId: string | null
  isLoading: boolean
  onSelect: (packageId: string) => void
}

export function PackageList({
  packages,
  selectedId,
  bestValueId,
  isLoading,
  onSelect,
}: PackageListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[4.75rem] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No coin packages are available right now.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3" role="listbox" aria-label="Coin packages">
      {packages.map((pkg) => {
        const selected = pkg.id === selectedId
        const isBestValue = pkg.id === bestValueId

        return (
          <button
            key={pkg.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(pkg.id)}
            className={cn(
              "group relative flex w-full items-center gap-4 rounded-xl border bg-card px-4 py-4 text-left transition-all",
              "hover:border-primary/40 hover:bg-accent/40",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : "border-border",
            )}
          >
            <span
              className={cn(
                "inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary group-hover:bg-primary/15",
              )}
            >
              <Coins className="size-5" strokeWidth={1.75} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {pkg.name}
                </span>
                {isBestValue ? (
                  <Badge variant="secondary" className="h-5">
                    Best value
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {pkg.coins.toLocaleString()} coins
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatPackagePrice(pkg.priceCents, pkg.currency)}
              </span>
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full border transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-transparent",
                )}
                aria-hidden
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
