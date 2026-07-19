import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PackageDetails } from "@/components/wallet/PackageDetails"
import { PackageList } from "@/components/wallet/PackageList"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { getBestValuePackageId } from "@/lib/wallet-format"
import { useAuthStore } from "@/stores/auth-store"
import { useWalletStore } from "@/stores/wallet-store"
import type { CoinPackage } from "@/types/wallet"

export function WalletPage() {
  const balanceCoins = useWalletStore((state) => state.balanceCoins)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)

  const [packages, setPackages] = useState<CoinPackage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoadingPackages, setIsLoadingPackages] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [packagesError, setPackagesError] = useState<string | null>(null)

  const bestValueId = useMemo(
    () => getBestValuePackageId(packages),
    [packages],
  )

  const selected = useMemo(
    () => packages.find((pkg) => pkg.id === selectedId) ?? null,
    [packages, selectedId],
  )

  const loadPackages = useCallback(async () => {
    setIsLoadingPackages(true)
    setPackagesError(null)
    try {
      const { data } = await api.wallet.listPackages()
      const active = data.packages.filter((pkg) => pkg.active)
      setPackages(active)
      setSelectedId((current) => {
        if (current && active.some((pkg) => pkg.id === current)) return current
        return active[0]?.id ?? null
      })
    } catch (error) {
      setPackages([])
      setSelectedId(null)
      setPackagesError(
        getApiErrorMessage(error, "Failed to load coin packages"),
      )
    } finally {
      setIsLoadingPackages(false)
    }
  }, [])

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      openAuthDrawer("login")
      return
    }

    if (!selected) return

    setIsCheckingOut(true)
    try {
      const { data } = await api.wallet.startCheckout(selected.id)
      window.location.assign(data.checkoutUrl)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to start checkout"))
      setIsCheckingOut(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Buy coins
          </h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            Top up your balance to generate and enhance thumbnails. Pick a pack,
            review the details, then checkout securely.
          </p>
        </div>

        {typeof balanceCoins === "number" ? (
          <p className="text-sm text-muted-foreground">
            Balance{" "}
            <span className="font-medium tabular-nums text-foreground">
              {balanceCoins.toLocaleString()}
            </span>{" "}
            coins
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-stretch">
        <section className="flex min-h-0 flex-col gap-3">
          <div className="flex shrink-0 items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">
              Token packages
            </h2>
            {!isLoadingPackages && packages.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {packages.length} available
              </p>
            ) : null}
          </div>

          {packagesError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
              <p className="text-sm text-destructive">{packagesError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void loadPackages()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <PackageList
                packages={packages}
                selectedId={selectedId}
                bestValueId={bestValueId}
                isLoading={isLoadingPackages}
                onSelect={setSelectedId}
              />
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col lg:min-h-[28rem]">
          <PackageDetails
            selected={selected}
            isBestValue={selected?.id === bestValueId}
            isLoading={isLoadingPackages}
            isCheckingOut={isCheckingOut}
            onCheckout={() => void handleCheckout()}
            className="h-full"
          />
        </aside>
      </div>
    </div>
  )
}
