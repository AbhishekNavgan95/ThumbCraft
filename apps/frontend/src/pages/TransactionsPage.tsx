import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

export function TransactionsPage() {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Transactions
          </h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            Payment history for coin package purchases.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard/wallet">Buy coins</Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void loadTransactions()}
          >
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No payments yet. Buy a coin pack to see it here.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/dashboard/wallet">Buy coins</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-right">Coins</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Payment ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(tx.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">{tx.packageName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    +{tx.coins.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(tx.status)}>
                      {statusLabel(tx.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden max-w-[12rem] truncate font-mono text-xs text-muted-foreground md:table-cell">
                    {tx.stripePaymentId ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
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
