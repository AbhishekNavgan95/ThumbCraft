import { useCallback, useEffect, useState } from "react"
import { ChevronRight, LayoutGrid } from "lucide-react"
import { CategoriesSkeleton } from "@/components/home/CategoriesSkeleton"
import { Button } from "@/components/ui/button"
import { api, getApiErrorMessage } from "@/lib/api-client"
import type { TemplateCategory } from "@/types/gallery"

type CategoriesSectionProps = {
  onSelectCategory: (categoryId: string) => void
}

export function CategoriesSection({ onSelectCategory }: CategoriesSectionProps) {
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data } = await api.gallery.listCategories()
      const sorted = [...data.categories].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      )
      setCategories(sorted)
    } catch (err) {
      setCategories([])
      setError(getApiErrorMessage(err, "Failed to load categories"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  if (isLoading && categories.length === 0) {
    return <CategoriesSkeleton />
  }

  if (error) {
    return (
      <section className="">
        <SectionHeader />
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => void loadCategories()}
          >
            Try again
          </Button>
        </div>
      </section>
    )
  }

  if (categories.length === 0) {
    return (
      <section className="space-y-5">
        <SectionHeader />
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No gallery categories yet. Check back soon.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <SectionHeader />
      <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2">
        {categories.map((category) => {
          const count = category.templateCount ?? 0
          const countLabel = `${count} template${count === 1 ? "" : "s"}`

          return (
            <li key={category.id} className="h-full">
              <button
                type="button"
                className="flex h-full min-h-[8.5rem] w-full items-start gap-4 rounded-2xl border border-border bg-card px-5 py-5 text-left transition-colors hover:border-primary/25 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => onSelectCategory(category.id)}
              >
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent-foreground">
                  <LayoutGrid className="size-5" strokeWidth={1.75} />
                </span>
                <span className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                  <span className="block truncate text-base font-medium tracking-tight text-foreground">
                    {category.name}
                  </span>
                  <span className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug text-muted-foreground">
                    {category.description?.trim() || "\u00A0"}
                  </span>
                  <span className="mt-auto block text-xs font-medium text-muted-foreground">
                    {countLabel}
                  </span>
                </span>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function SectionHeader() {
  return (
    <div className="space-y-1.5">
      <h2 className="text-xl font-medium tracking-tight text-foreground">
        Or start from the gallery
      </h2>
      <p className="max-w-lg text-sm text-muted-foreground">
        Choose a category to browse templates on the next page, then customize
        with your prompt or image.
      </p>
    </div>
  )
}
