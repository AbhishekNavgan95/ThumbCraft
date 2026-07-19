import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { CategoriesSection } from "@/components/home/CategoriesSection"
import { HeroSection, type StartMode } from "@/components/home/HeroSection"
import { SiteHeader } from "@/components/home/SiteHeader"
import { useAuthStore } from "@/stores/auth-store"
import { useGenerationStore } from "@/stores/generation-store"

export function HomePage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)
  const startFlow = useGenerationStore((state) => state.startFlow)

  const handleStart = useCallback(
    (mode: StartMode) => {
      if (!isAuthenticated) {
        openAuthDrawer("signup")
        return
      }
      startFlow(mode)
      navigate(`/dashboard/new?mode=${mode}`)
    },
    [isAuthenticated, navigate, openAuthDrawer, startFlow],
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

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-4 sm:px-6 sm:pt-6">
        <CategoriesSection onSelectCategory={handleCategory} />
      </main>
    </div>
  )
}
