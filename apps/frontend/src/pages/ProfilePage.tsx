import { Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionHistory } from "@/components/wallet/TransactionHistory"
import { useAuthStore } from "@/stores/auth-store"
import { useWalletStore } from "@/stores/wallet-store"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

export function ProfilePage() {
  const user = useAuthStore((state) => state.user)
  const balanceCoins = useWalletStore((state) => state.balanceCoins)
  const openBuyDrawer = useWalletStore((state) => state.openBuyDrawer)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col py-2 sm:py-3">
      <header className="flex shrink-0 flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {user ? (
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials(user.name)}
            </span>
          ) : null}
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
              {user?.name ?? "Profile"}
            </h1>
            {user?.email ? (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {typeof balanceCoins === "number" ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-2.5 py-1 text-xs shadow-xs">
              <Coins className="size-3 text-muted-foreground" strokeWidth={2} />
              <span className="text-muted-foreground">Balance</span>
              <span className="font-semibold tabular-nums text-foreground">
                {balanceCoins.toLocaleString()}
              </span>
            </div>
          ) : null}
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => openBuyDrawer()}
          >
            Buy coins
          </Button>
        </div>
      </header>

      <section className="mt-5 space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Transaction history
          </h2>
        </div>
        <TransactionHistory onBuyCoins={() => openBuyDrawer()} />
      </section>
    </div>
  )
}
