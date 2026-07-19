import type { CoinPackage } from "@/types/wallet"

export function formatPackagePrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(priceCents / 100)
}

export function getBestValuePackageId(packages: CoinPackage[]): string | null {
  if (packages.length === 0) return null

  let bestId = packages[0].id
  let bestRatio = packages[0].coins / Math.max(packages[0].priceCents, 1)

  for (const pkg of packages.slice(1)) {
    const ratio = pkg.coins / Math.max(pkg.priceCents, 1)
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestId = pkg.id
    }
  }

  return bestId
}
