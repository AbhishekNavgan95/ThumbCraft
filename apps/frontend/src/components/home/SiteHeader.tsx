import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ChevronDown, Coins, LogOut, MessageSquarePlus, UserRound } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth-store"
import { useWalletStore } from "@/stores/wallet-store"

function formatCoins(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value,
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

export function SiteHeader() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)
  const logout = useAuthStore((state) => state.logout)

  const balanceCoins = useWalletStore((state) => state.balanceCoins)
  const isWalletLoading = useWalletStore((state) => state.isLoading)
  const refreshWallet = useWalletStore((state) => state.refresh)
  const resetWallet = useWalletStore((state) => state.reset)
  const openBuyDrawer = useWalletStore((state) => state.openBuyDrawer)

  const [signOutOpen, setSignOutOpen] = useState(false)

  useEffect(() => {
    if (isBootstrapping) return
    if (isAuthenticated) {
      void refreshWallet()
      return
    }
    resetWallet()
  }, [isAuthenticated, isBootstrapping, refreshWallet, resetWallet])

  const handleLogout = () => {
    resetWallet()
    logout()
    setSignOutOpen(false)
  }

  return (
    <header className="fixed w-full top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <img
            src="/logo.png"
            alt="Thumbcraft"
            className="h-6 w-auto object-contain sm:h-8"
          />
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          {isAuthenticated && user ? (
            <>
              <button
                type="button"
                onClick={() => openBuyDrawer()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-2.5 py-1 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`${balanceCoins ?? 0} coins — buy coins`}
              >
                <Coins className="size-3.5 text-primary" strokeWidth={2} />
                {isWalletLoading && balanceCoins === null ? (
                  <Skeleton className="h-4 w-8 rounded-full" />
                ) : (
                  <span>{formatCoins(balanceCoins ?? 0)}</span>
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 rounded-full border-border/80 bg-card/90 pr-1.5 pl-1 shadow-xs"
                  >
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[9px] font-semibold tracking-wide text-primary-foreground">
                      {initials(user.name)}
                    </span>
                    <span className="hidden max-w-24 truncate text-xs font-medium sm:inline">
                      {user.name}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 p-0.5">
                  <DropdownMenuLabel className="px-2 py-1.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate text-xs font-medium text-foreground">
                        {user.name}
                      </span>
                      <span className="truncate text-[11px] font-normal text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-1.5 py-1.5 text-xs"
                    onSelect={() => navigate("/dashboard/new")}
                  >
                    <MessageSquarePlus className="size-3.5" />
                    New chat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-1.5 py-1.5 text-xs"
                    onSelect={() => navigate("/dashboard/profile")}
                  >
                    <UserRound className="size-3.5" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-1.5 py-1.5 text-xs"
                    onSelect={() => openBuyDrawer()}
                  >
                    <Coins className="size-3.5" />
                    Buy coins
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="gap-1.5 py-1.5 text-xs"
                    onSelect={(event) => {
                      event.preventDefault()
                      setSignOutOpen(true)
                    }}
                  >
                    <LogOut className="size-3.5" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You’ll need to sign in again to generate thumbnails and
                      manage your wallet.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleLogout}
                    >
                      Sign out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openAuthDrawer("login")}
              >
                Sign in
              </Button>
              <Button size="sm" onClick={() => openAuthDrawer("signup")}>
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
