import { useEffect } from "react"
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom"
import { History, Wallet } from "lucide-react"
import { SiteHeader } from "@/components/home/SiteHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

const navItems = [
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet, end: true },
  {
    to: "/dashboard/transactions",
    label: "Transactions",
    icon: History,
    end: true,
  },
] as const

export function DashboardLayout() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)

  const isConfirmRoute = location.pathname.startsWith(
    "/dashboard/wallet/confirm",
  )

  useEffect(() => {
    if (isBootstrapping) return
    if (!isAuthenticated) {
      openAuthDrawer("login")
    }
  }, [isAuthenticated, isBootstrapping, openAuthDrawer])

  if (isBootstrapping) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <SiteHeader />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // Keep Stripe return URL intact while prompting login.
  if (!isAuthenticated && !isConfirmRoute) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        {!isConfirmRoute ? (
          <nav className="flex gap-1 border-b border-border pt-4">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="size-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col py-6 sm:py-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
