import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { PreferenceQuestionnaire } from "@/components/generation/PreferenceQuestionnaire"
import { PromptComposer } from "@/components/generation/PromptComposer"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/stores/chat-store"
import { useGenerationStore } from "@/stores/generation-store"
import type { GenerateStartMode } from "@/types/generation"

function parseMode(value: string | null): GenerateStartMode {
  return value === "image" ? "image" : "prompt"
}

const PROMPT_STARTERS = [
  "Bold YouTube thumbnail for a tech review",
  "Cinematic gaming thumbnail with neon accents",
  "Clean tutorial cover with readable title space",
  "High-energy podcast episode artwork",
] as const

const IMAGE_STARTERS = [
  "Restyle this into a viral YouTube thumbnail",
  "Keep the subject, make the background dramatic",
  "Add bold overlay text and stronger contrast",
  "Crop and reframe for a 16:9 cover",
] as const

export function NewChatPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = parseMode(searchParams.get("mode"))

  const step = useGenerationStore((state) => state.step)
  const models = useGenerationStore((state) => state.models)
  const isLoadingModels = useGenerationStore((state) => state.isLoadingModels)
  const modelsError = useGenerationStore((state) => state.modelsError)
  const startFlow = useGenerationStore((state) => state.startFlow)
  const loadModels = useGenerationStore((state) => state.loadModels)
  const commitPromptStep = useGenerationStore((state) => state.commitPromptStep)
  const setStep = useGenerationStore((state) => state.setStep)
  const setPrompt = useGenerationStore((state) => state.setPrompt)

  const startGenerationFromContext = useChatStore(
    (state) => state.startGenerationFromContext,
  )

  useEffect(() => {
    if (step === "preferences") return
    startFlow(mode)
    // Intentionally bootstrap the wizard when entering this route / changing mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid resetting mid-questionnaire
  }, [mode, startFlow])

  useEffect(() => {
    void loadModels()
  }, [loadModels])

  const handleContinue = () => {
    if (!commitPromptStep()) {
      toast.error(
        mode === "image"
          ? "Add a prompt and wait for uploads to finish."
          : "Add a prompt and choose a model first.",
      )
    }
  }

  const handlePreferencesComplete = () => {
    void startGenerationFromContext().then((sessionId) => {
      const error = useChatStore.getState().generationError
      if (error || !sessionId) {
        toast.error(error ?? "Failed to start generation")
        return
      }
      navigate(`/dashboard/sessions/${sessionId}`, { replace: true })
    })
  }

  const showQuestionnaire = step === "preferences"
  const starters = mode === "image" ? IMAGE_STARTERS : PROMPT_STARTERS

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {!showQuestionnaire ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute inset-0 opacity-40">
            <div className="hero-blob hero-blob-a absolute top-[-28%] left-[-8%] size-[78%]" />
            <div className="hero-blob hero-blob-b absolute top-[-5%] right-[-22%] size-[72%]" />
            <div className="hero-blob hero-blob-c absolute bottom-[-30%] left-[18%] size-[70%]" />
          </div>
          <div className="studio-grid absolute inset-0" />
          <div className="studio-edge-fade absolute inset-0" />
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col items-center px-4",
          showQuestionnaire
            ? "justify-center py-8 sm:px-6 sm:py-10"
            : "justify-center py-10 sm:px-6 sm:py-14",
        )}
      >
        {!showQuestionnaire ? (
          <div className="mb-8 w-full max-w-2xl space-y-4 text-center sm:mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur-sm">
              <Sparkles className="size-3 text-primary" strokeWidth={2} />
              Get started
            </div>
            <div className="space-y-2">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {mode === "image"
                  ? "What should we do with your image?"
                  : "What thumbnail should we create?"}
              </h1>
              <p className="mx-auto max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {mode === "image"
                  ? "Attach a reference, set the model, then tell the agent how to transform it."
                  : "Describe the cover. The agent will refine intent, then generate."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="w-full max-w-3xl">
          {showQuestionnaire ? (
            <PreferenceQuestionnaire
              onComplete={handlePreferencesComplete}
              onBackToPrompt={() => setStep("prompt")}
            />
          ) : modelsError && models.length === 0 ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-center">
              <p className="text-sm text-destructive">{modelsError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => void loadModels()}
              >
                Try again
              </Button>
            </div>
          ) : isLoadingModels && models.length === 0 ? (
            <div className="rounded-3xl border border-border/70 bg-card/90 p-5 shadow-lg backdrop-blur-sm">
              <Skeleton className="mb-4 h-28 w-full rounded-2xl" />
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-28 rounded-full" />
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="size-9 rounded-full" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <PromptComposer onContinue={handleContinue} />
              <div className="flex flex-wrap justify-center gap-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => setPrompt(starter)}
                    className={cn(
                      "rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-left text-xs text-muted-foreground shadow-xs backdrop-blur-sm",
                      "transition-colors hover:border-border hover:bg-card hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    )}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
