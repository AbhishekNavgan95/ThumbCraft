import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Coins } from "lucide-react"
import { toast } from "sonner"
import { PackageDetails } from "@/components/wallet/PackageDetails"
import { PackageList } from "@/components/wallet/PackageList"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { getBestValuePackageId } from "@/lib/wallet-format"
import { useAuthStore } from "@/stores/auth-store"
import { useWalletStore } from "@/stores/wallet-store"
import type { CoinPackage } from "@/types/wallet"

type BuyStep = "select" | "checkout"

const STEPS = [
  { id: "select" as const, label: "Choose plan" },
  { id: "checkout" as const, label: "Checkout" },
]

export function BuyCoinsDrawer() {
  const buyDrawerOpen = useWalletStore((state) => state.buyDrawerOpen)
  const setBuyDrawerOpen = useWalletStore((state) => state.setBuyDrawerOpen)
  const balanceCoins = useWalletStore((state) => state.balanceCoins)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)

  const [step, setStep] = useState<BuyStep>("select")
  const [packages, setPackages] = useState<CoinPackage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoadingPackages, setIsLoadingPackages] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [packagesError, setPackagesError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

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
      setHasLoaded(true)
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
    if (!buyDrawerOpen) {
      setStep("select")
      setSelectedId(null)
      setIsCheckingOut(false)
      return
    }
    if (hasLoaded && packages.length > 0) return
    void loadPackages()
  }, [buyDrawerOpen, hasLoaded, loadPackages, packages.length])

  const handleSelectPackage = (packageId: string) => {
    setSelectedId(packageId)
    setStep("checkout")
  }

  const handleBack = () => {
    setStep("select")
  }

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      setBuyDrawerOpen(false)
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
    <Sheet open={buyDrawerOpen} onOpenChange={setBuyDrawerOpen}>
      <SheetContent
        side="right"
        className="h-full max-h-svh w-full gap-0 overflow-hidden p-0 data-[side=right]:inset-y-0 data-[side=right]:h-svh data-[side=right]:max-h-svh data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <SheetTitle className="text-base font-semibold">
                Buy coins
              </SheetTitle>
              <SheetDescription className="text-xs">
                {step === "select"
                  ? "Pick a pack to continue."
                  : "Review your plan and checkout."}
              </SheetDescription>
            </div>
            {typeof balanceCoins === "number" ? (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-xs">
                <Coins
                  className="size-3 text-muted-foreground"
                  strokeWidth={2}
                />
                <span className="font-semibold tabular-nums text-foreground">
                  {balanceCoins.toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>

          <ol
            className="mt-4 flex items-center gap-2"
            aria-label="Checkout steps"
          >
            {STEPS.map((item, index) => {
              const active = step === item.id
              const complete =
                item.id === "select" ? step === "checkout" : false

              return (
                <li
                  key={item.id}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                        active || complete
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[11px] font-medium",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 ? (
                    <span
                      className={cn(
                        "h-px min-w-4 flex-1",
                        complete ? "bg-primary/50" : "bg-border",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {step === "select" ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Packages
                </h2>
                {!isLoadingPackages && packages.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {packages.length} available
                  </p>
                ) : null}
              </div>

              {packagesError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-xs text-destructive">{packagesError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2.5 h-8 text-xs"
                    onClick={() => void loadPackages()}
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <PackageList
                  packages={packages}
                  selectedId={selectedId}
                  bestValueId={bestValueId}
                  isLoading={isLoadingPackages}
                  onSelect={handleSelectPackage}
                />
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-3 h-8 w-fit -ml-2 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleBack}
              >
                <ArrowLeft className="size-3.5" />
                Change plan
              </Button>

              <PackageDetails
                selected={selected}
                isBestValue={selected?.id === bestValueId}
                isLoading={false}
                isCheckingOut={isCheckingOut}
                onCheckout={() => void handleCheckout()}
                className="min-h-0 flex-1"
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
