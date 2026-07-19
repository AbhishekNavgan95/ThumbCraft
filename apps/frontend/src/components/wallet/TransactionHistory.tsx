import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, getApiErrorMessage } from "@/lib/api-client"
import type { PaymentStatusValue, WalletTransaction } from "@/types/wallet"

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function statusVariant(
  status: PaymentStatusValue,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default"
    case "pending":
      return "secondary"
    case "failed":
    case "expired":
      return "destructive"
    default:
      return "outline"
  }
}

function statusLabel(status: PaymentStatusValue) {
  switch (status) {
    case "completed":
      return "Completed"
    case "pending":
      return "Pending"
    case "failed":
      return "Failed"
    case "expired":
      return "Expired"
    default:
      return status
  }
}

type TransactionHistoryProps = {
  onBuyCoins?: () => void
}

export function TransactionHistory({ onBuyCoins }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTransactions = useCallback(async (cursor?: string) => {
    const appending = Boolean(cursor)
    if (appending) setIsLoadingMore(true)
    else {
      setIsLoading(true)
      setError(null)
    }

    try {
      const { data } = await api.wallet.listTransactions({
        limit: 20,
        cursor,
      })
      setTransactions((current) =>
        appending ? [...current, ...data.transactions] : data.transactions,
      )
      setNextCursor(data.nextCursor)
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load transactions"))
      if (!appending) setTransactions([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
        <p className="text-xs text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-8 text-xs"
          onClick={() => void loadTransactions()}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
        <p className="text-xs text-muted-foreground">
          No payments yet. Buy a coin pack to see it here.
        </p>
        {onBuyCoins ? (
          <Button
            size="sm"
            className="mt-4 h-8 text-xs"
            onClick={onBuyCoins}
          >
            Buy coins
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-9 text-xs">Date</TableHead>
              <TableHead className="h-9 text-xs">Package</TableHead>
              <TableHead className="h-9 text-right text-xs">Coins</TableHead>
              <TableHead className="h-9 text-xs">Status</TableHead>
              <TableHead className="hidden h-9 text-xs md:table-cell">
                Payment ID
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap py-2.5 text-xs text-muted-foreground">
                  {formatDate(tx.createdAt)}
                </TableCell>
                <TableCell className="py-2.5 text-xs font-medium">
                  {tx.packageName}
                </TableCell>
                <TableCell className="py-2.5 text-right text-xs tabular-nums">
                  +{tx.coins.toLocaleString()}
                </TableCell>
                <TableCell className="py-2.5">
                  <Badge
                    variant={statusVariant(tx.status)}
                    className="h-5 px-1.5 text-[10px]"
                  >
                    {statusLabel(tx.status)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden max-w-48 truncate py-2.5 font-mono text-[11px] text-muted-foreground md:table-cell">
                  {tx.stripePaymentId ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={isLoadingMore}
            onClick={() => void loadTransactions(nextCursor)}
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
