import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/home/SiteHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/** Templates for a gallery category — shown after the user picks a category. */
export function CategoryTemplatesPage() {
  const { categoryId = "" } = useParams()
  const navigate = useNavigate()

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 gap-1.5 text-muted-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Button>

        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <p className="sr-only">Category {categoryId}</p>
        </div>

        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4"
          aria-busy="true"
          aria-label="Templates loading"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
