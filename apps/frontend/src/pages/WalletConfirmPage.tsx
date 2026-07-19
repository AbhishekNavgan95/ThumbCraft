import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import { useAuthStore } from "@/stores/auth-store"
import { useWalletStore } from "@/stores/wallet-store"
import type { PaymentStatusValue } from "@/types/wallet"

type ConfirmState =
  | { kind: "loading"; title: string; detail: string }
  | { kind: "success"; title: string; detail: string }
  | { kind: "error"; title: string; detail: string }
  | { kind: "cancelled"; title: string; detail: string }

const POLL_INTERVAL_MS = 1500
const MAX_ATTEMPTS = 12

export function WalletConfirmPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const refreshWallet = useWalletStore((state) => state.refresh)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)

  const checkout = searchParams.get("checkout")
  const sessionId = searchParams.get("session_id")

  const [state, setState] = useState<ConfirmState>(() => {
    if (checkout === "cancel") {
      return {
        kind: "cancelled",
        title: "Checkout cancelled",
        detail: "No charge was made. You can try again anytime.",
      }
    }
    return {
      kind: "loading",
      title: "Confirming payment",
      detail: "This usually takes a few seconds.",
    }
  })

  useEffect(() => {
    if (checkout === "cancel") return
    if (isBootstrapping) return

    if (!isAuthenticated) {
      openAuthDrawer("login")
      return
    }

    if (!sessionId) {
      setState({
        kind: "error",
        title: "Missing session",
        detail: "We couldn’t find a checkout session to confirm.",
      })
      return
    }

    let cancelled = false
    let attempts = 0

    const poll = async () => {
      while (!cancelled && attempts < MAX_ATTEMPTS) {
        attempts += 1
        try {
          const { data } = await api.wallet.getPaymentStatus(sessionId)
          const status: PaymentStatusValue = data.payment.status

          if (status === "completed") {
            await refreshWallet()
            if (cancelled) return
            setState({
              kind: "success",
              title: "Payment confirmed",
              detail: `${data.payment.coins.toLocaleString()} coins added to your wallet.`,
            })
            return
          }

          if (status === "failed" || status === "expired") {
            if (cancelled) return
            setState({
              kind: "error",
              title: status === "failed" ? "Payment failed" : "Checkout expired",
              detail:
                data.payment.failureReason ??
                "Please try again with another package.",
            })
            return
          }
        } catch {
          // Webhook may still be catching up.
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }

      if (cancelled) return

      await refreshWallet()
      setState({
        kind: "error",
        title: "Still processing",
        detail:
          "Payment is taking longer than expected. Your balance will update shortly.",
      })
    }

    void poll()

    return () => {
      cancelled = true
    }
  }, [
    checkout,
    isAuthenticated,
    isBootstrapping,
    openAuthDrawer,
    refreshWallet,
    sessionId,
  ])

  const icon =
    state.kind === "loading" ? (
      <Loader2 className="size-8 animate-spin text-primary" />
    ) : state.kind === "success" ? (
      <CheckCircle2 className="size-8 text-primary" />
    ) : (
      <XCircle className="size-8 text-destructive" />
    )

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-muted">
        {icon}
      </div>

      <h1 className="text-xl font-medium tracking-tight text-foreground">
        {state.title}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {state.detail}
      </p>

      {state.kind !== "loading" ? (
        <div className="mt-8 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={() => navigate("/dashboard/wallet", { replace: true })}
          >
            Back to wallet
          </Button>
          {state.kind === "success" ? (
            <Button variant="outline" asChild>
              <Link to="/dashboard/transactions">View transactions</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
