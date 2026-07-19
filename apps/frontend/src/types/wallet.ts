export type WalletBalance = {
  balanceCoins: number
  reservedCoins: number
}

export type CoinPackage = {
  id: string
  name: string
  coins: number
  priceCents: number
  currency: string
  active: boolean
}

export type PackagesResponse = {
  packages: CoinPackage[]
}

export type CheckoutStart = {
  checkoutUrl: string
  sessionId: string
}

export type PaymentStatusValue = "pending" | "completed" | "failed" | "expired"

export type PaymentStatusResponse = {
  payment: {
    sessionId: string
    status: PaymentStatusValue
    coins: number
    packageId: string
    packageName: string
    stripePaymentId: string | null
    failureReason: string | null
    updatedAt: string
  }
}

export type WalletTransaction = {
  id: string
  sessionId: string
  packageId: string
  packageName: string
  coins: number
  status: PaymentStatusValue
  stripePaymentId: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

export type TransactionsResponse = {
  transactions: WalletTransaction[]
  nextCursor: string | null
}
