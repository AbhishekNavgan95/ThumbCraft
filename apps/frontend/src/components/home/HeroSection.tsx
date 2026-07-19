import type { ReactNode } from "react"
import { ImagePlus, Type } from "lucide-react"
import { cn } from "@/lib/utils"

export type StartMode = "prompt" | "image"

type HeroSectionProps = {
  onSelect: (mode: StartMode) => void
}

export function HeroSection({ onSelect }: HeroSectionProps) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Brand-palette moving gradient mesh */}
      <div aria-hidden className="hero-mesh pointer-events-none absolute inset-0 -z-10">
        <div className="hero-mesh__aurora" />
        <div className="hero-mesh__blob hero-mesh__blob--a" />
        <div className="hero-mesh__blob hero-mesh__blob--b" />
        <div className="hero-mesh__blob hero-mesh__blob--c" />
        <div className="hero-mesh__blob hero-mesh__blob--d" />
        <div className="hero-mesh__grid" />
        <div className="hero-mesh__fade" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20 md:py-24">
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="font-serif text-4xl tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Thumbcraft
          </p>
          <h1 className="text-2xl font-medium leading-snug tracking-tight text-foreground sm:text-3xl">
            Thumbnails that stop the scroll
          </h1>
          <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Create scroll-stopping covers for any social platform — from a
            prompt or a reference image. Built for creators who ship daily.
          </p>
        </div>

        <div className="mt-10 w-full max-w-xl animate-in fade-in slide-in-from-bottom-3 duration-700">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Get started
          </p>
          <div className="grid gap-3 sm:grid-cols-2 sm:text-left">
            <StartPath
              title="Start with prompt"
              description="Describe the vibe, text, and scene."
              icon={<Type className="size-5" strokeWidth={1.75} />}
              onClick={() => onSelect("prompt")}
            />
            <StartPath
              title="Start with image"
              description="Upload a face, product, or frame."
              icon={<ImagePlus className="size-5" strokeWidth={1.75} />}
              onClick={() => onSelect("image")}
              accent
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function StartPath({
  title,
  description,
  icon,
  onClick,
  accent = false,
}: {
  title: string
  description: string
  icon: ReactNode
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all",
        "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        accent
          ? "border-primary/25 bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
          : "border-border bg-card/80 text-card-foreground shadow-xs backdrop-blur-sm hover:border-primary/30 hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
          accent
            ? "bg-primary-foreground/15 text-primary-foreground"
            : "bg-secondary text-accent-foreground",
        )}
      >
        {icon}
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-medium tracking-tight">{title}</span>
        <span
          className={cn(
            "block text-xs leading-relaxed",
            accent ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {description}
        </span>
      </span>
    </button>
  )
}
