import { Skeleton } from "@/components/ui/skeleton"

/** Loading placeholder for gallery categories on the home page. */
export function CategoriesSkeleton() {
  return (
    <section className="space-y-5" aria-busy="true" aria-label="Categories loading">
      <div className="space-y-1.5">
        <h2 className="text-xl font-medium tracking-tight text-foreground">
          Or start from the gallery
        </h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          Choose a category to browse templates on the next page, then customize
          with your prompt or image.
        </p>
      </div>

      <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <li
            key={index}
            className="flex h-full min-h-[8.5rem] items-start gap-4 rounded-2xl border border-border bg-card px-5 py-5"
          >
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="mt-1 size-5 shrink-0 rounded-full" />
          </li>
        ))}
      </ul>
    </section>
  )
}
