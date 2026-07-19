import { useEffect } from "react"
import { Outlet } from "react-router-dom"
import { AuthDrawer } from "@/components/auth/AuthDrawer"
import { useAuthStore } from "@/stores/auth-store"

export function AppLayout() {
  const init = useAuthStore((state) => state.init)

  useEffect(() => init(), [init])

  return (
    <div className="min-h-svh">
      <Outlet />
      <AuthDrawer />
    </div>
  )
}
