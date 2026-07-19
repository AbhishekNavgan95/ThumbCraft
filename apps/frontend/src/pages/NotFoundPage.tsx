import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        That route does not exist yet.
      </p>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </main>
  )
}
