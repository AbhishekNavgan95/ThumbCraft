import { ArrowRight, ImagePlus, Type } from "lucide-react"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export type StartMode = "prompt" | "image"

type HeroSectionProps = {
  onSelect: (mode: StartMode) => void
}

const AVATARS = [
  { src: "https://api.dicebear.com/9.x/avataaars/svg?seed=maya", fallback: "MY" },
  { src: "https://api.dicebear.com/9.x/avataaars/svg?seed=jordan", fallback: "JD" },
  { src: "https://api.dicebear.com/9.x/avataaars/svg?seed=alex", fallback: "AX" },
  { src: "https://api.dicebear.com/9.x/avataaars/svg?seed=sam", fallback: "SM" },
]

export function HeroSection({ onSelect }: HeroSectionProps) {
  return (
    <section className="relative isolate overflow-visible pb-8 sm:py-10 md:py-12">
      {/* Animated accent mesh — soft white fade blends into next section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[calc(100%+6rem)] overflow-hidden sm:h-[calc(100%+8rem)]"
      >
        <div className="hero-blob hero-blob-b absolute right-[12%] top-[18%] size-[36rem] max-w-none rounded-full" />
        <div className="hero-blob hero-blob-c absolute bottom-[8%] left-[18%] size-[44rem] max-w-none rounded-full" />
        <div className="hero-mesh absolute inset-0" />
        {/* Soft white wash — fades bottom + left/right edges */}
        <div className="hero-fade absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20 md:py-24">
        {/* Social proof */}
        <div className="mb-8 flex flex-col items-center gap-3 sm:mb-10 sm:flex-row sm:gap-3">
          <AvatarGroup>
            {AVATARS.map((avatar) => (
              <Avatar key={avatar.src} size="sm">
                <AvatarImage src={avatar.src} alt="" />
                <AvatarFallback>{avatar.fallback}</AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
          <p className="max-w-xs text-xs leading-snug text-muted-foreground sm:max-w-none sm:text-left sm:text-sm">
            Trusted by 1000+ creators
          </p>
        </div>

        {/* Headline */}
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-6xl md:leading-[1.15]">
          Create scroll-stopping thumbnails in{" "}
          <span className="text-primary">minutes</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Start from a prompt or a reference image and ship covers that work
          across every social platform.
        </p>

        {/* Centered CTAs */}
        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row">
          <Button
            size="lg"
            className="h-11 rounded-full px-6 shadow-md"
            onClick={() => onSelect("prompt")}
          >
            <Type className="size-4" strokeWidth={2} />
            Start with prompt
            <ArrowRight className="size-4" strokeWidth={2} />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 rounded-full border-border bg-card px-6 shadow-xs"
            onClick={() => onSelect("image")}
          >
            <ImagePlus className="size-4" strokeWidth={2} />
            Start with image
          </Button>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Works for any social platform
        </p>
      </div>
    </section>
  )
}
