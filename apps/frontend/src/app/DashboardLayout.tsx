import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth-store"

function isImmersiveRoute(pathname: string) {
  return (
    pathname.startsWith("/dashboard/new") ||
    pathname.startsWith("/dashboard/sessions/")
  )
}

export function DashboardLayout() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)
  const [mobileOpen, setMobileOpen] = useState(false)

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
      <div className="flex min-h-svh bg-background">
        <div className="hidden w-64 border-r border-border/70 p-3 md:block">
          <Skeleton className="mb-4 h-8 w-32" />
          <Skeleton className="mb-2 h-10 w-full" />
          <Skeleton className="mb-2 h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated && !isConfirmRoute) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <div className="hidden h-full md:flex">
        <DashboardSidebar />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/30"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full shadow-xl">
            <DashboardSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">


        <main className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={
              isImmersiveRoute(location.pathname)
                ? "flex h-full min-h-0 w-full flex-col"
                : "flex h-full w-full flex-col px-4 py-4"
            }
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
