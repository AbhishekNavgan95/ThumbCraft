import { Loader2, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPackagePrice } from "@/lib/wallet-format";
import type { CoinPackage } from "@/types/wallet";

type PackageDetailsProps = {
  selected: CoinPackage | null;
  isBestValue: boolean;
  isLoading: boolean;
  isCheckingOut: boolean;
  onCheckout: () => void;
  className?: string;
};

export function PackageDetails({
  selected,
  isBestValue,
  isLoading,
  isCheckingOut,
  onCheckout,
  className,
}: PackageDetailsProps) {
  if (isLoading) {
    return (
      <Card className={cn("rounded-2xl ring-border/60", className)}>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-7 w-40" />
          <Skeleton className="mt-1 h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!selected) {
    return (
      <Card className={cn("rounded-2xl ring-border/60", className)}>
        <CardHeader>
          <CardTitle>Select a package</CardTitle>
          <CardDescription>
            Choose a coin pack on the left to review pricing and checkout.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const price = formatPackagePrice(selected.priceCents, selected.currency);
  const perCoin =
    selected.coins > 0
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: selected.currency.toUpperCase(),
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }).format(selected.priceCents / 100 / selected.coins)
      : null;

  return (
    <Card className={cn("rounded-2xl ring-border/60", className)}>
      <CardHeader className="shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardDescription className="text-xs font-medium tracking-wide uppercase">
            Selected plan
          </CardDescription>
        </div>
        <CardTitle className="text-2xl tracking-tight flex items-center gap-2">
          {selected.name}
          {isBestValue ? <Badge className="h-5">Best value</Badge> : null}
        </CardTitle>
        <CardDescription>
          Instant credit after payment. Coins never expire.
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        <div className="rounded-xl bg-muted/60 px-4 py-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            You get
          </p>
          <p className="mt-1 text-3xl font-medium tracking-tight tabular-nums text-foreground">
            {selected.coins.toLocaleString()}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              coins
            </span>
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Price</span>
            <span className="font-medium tabular-nums text-foreground">
              {price}
            </span>
          </div>
          {perCoin ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Per coin</span>
              <span className="tabular-nums text-foreground">{perCoin}</span>
            </div>
          ) : null}
        </div>

        <Separator />

        <ul className="space-y-2.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2.5">
            <Zap className="mt-0.5 size-4 shrink-0 text-primary" />
            Generate and enhance thumbnails right away
          </li>
          <li className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Secure checkout powered by Stripe
          </li>
        </ul>
      </CardContent>

      <CardFooter className="mt-auto shrink-0 flex-col items-stretch gap-3 border-t-0 bg-transparent">
        <Button
          size="lg"
          className="h-11 w-full text-sm"
          disabled={isCheckingOut}
          onClick={onCheckout}
        >
          {isCheckingOut ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Redirecting…
            </>
          ) : (
            <>Get now — {price}</>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You&apos;ll be redirected to Stripe to complete payment.
        </p>
      </CardFooter>
    </Card>
  );
}
