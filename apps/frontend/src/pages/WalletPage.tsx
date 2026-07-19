import { Link } from "react-router-dom"
import { ArrowLeft, Coins } from "lucide-react"
import { SiteHeader } from "@/components/home/SiteHeader"
import { Button } from "@/components/ui/button"
import { useWalletStore } from "@/stores/wallet-store"

/** Wallet top-up page — packages / Stripe checkout land here next. */
export function WalletPage() {
  const balanceCoins = useWalletStore((state) => state.balanceCoins)

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 gap-1.5 text-muted-foreground"
          asChild
        >
          <Link to="/">
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </Button>

        <div className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Buy coins
          </h1>
          <p className="text-sm text-muted-foreground">
            Top up your balance to generate and enhance thumbnails.
          </p>
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Coins className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Available balance
            </p>
            <p className="text-xl font-medium tracking-tight text-foreground">
              {balanceCoins ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                coins
              </span>
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Coin packages and checkout will appear here next.
          </p>
        </div>
      </main>
    </div>
  )
}
