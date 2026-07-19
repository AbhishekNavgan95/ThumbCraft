import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { CategoriesSection } from "@/components/home/CategoriesSection"
import { HeroSection, type StartMode } from "@/components/home/HeroSection"
import { SiteHeader } from "@/components/home/SiteHeader"
import { useAuthStore } from "@/stores/auth-store"

export function HomePage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)

  const handleStart = useCallback(
    (mode: StartMode) => {
      if (!isAuthenticated) {
        openAuthDrawer("signup")
        return
      }
      // Studio / session create lands here in a later pass.
      console.info(`[home] start with ${mode}`)
    },
    [isAuthenticated, openAuthDrawer],
  )

  const handleCategory = useCallback(
    (categoryId: string) => {
      navigate(`/gallery/${categoryId}`)
    },
    [navigate],
  )

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <HeroSection onSelect={handleStart} />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <CategoriesSection onSelectCategory={handleCategory} />
      </main>
    </div>
  )
}
