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
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          No coin packages are available right now.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2" role="listbox" aria-label="Coin packages">
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
              "group relative flex w-full items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors",
              "hover:border-primary/35 hover:bg-accent/30",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary/4 ring-1 ring-primary/25"
                : "border-border/80",
            )}
          >
            <span
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Coins className="size-3.5" strokeWidth={1.75} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-xs font-medium text-foreground">
                  {pkg.name}
                </span>
                {isBestValue ? (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1.5 text-[10px] font-medium"
                  >
                    Best value
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                {pkg.coins.toLocaleString()} coins
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {formatPackagePrice(pkg.priceCents, pkg.currency)}
              </span>
              <span
                className={cn(
                  "inline-flex size-3.5 items-center justify-center rounded-full border transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-transparent",
                )}
                aria-hidden
              >
                <Check className="size-2" strokeWidth={3} />
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
