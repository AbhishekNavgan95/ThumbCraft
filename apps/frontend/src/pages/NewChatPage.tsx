import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { PreferenceQuestionnaire } from "@/components/generation/PreferenceQuestionnaire"
import { PromptComposer } from "@/components/generation/PromptComposer"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useChatStore } from "@/stores/chat-store"
import { useGenerationStore } from "@/stores/generation-store"
import type { GenerateStartMode } from "@/types/generation"

function parseMode(value: string | null): GenerateStartMode {
  return value === "image" ? "image" : "prompt"
}

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
      // Job poll is already running; session page keeps it bound.
      navigate(`/dashboard/sessions/${sessionId}`, { replace: true })
    })
  }

  const showQuestionnaire = step === "preferences"

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      {!showQuestionnaire ? (
        <div className="mb-8 w-full max-w-2xl space-y-2 text-center sm:mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {mode === "image" ? "Start from an image" : "Start from a prompt"}
          </h2>
          <p className="mx-auto text-sm text-muted-foreground sm:text-base">
            {mode === "image"
              ? "Attach a reference, pick a model, then describe the cover you want."
              : "Describe the thumbnail, choose a model and framing, then continue."}
          </p>
        </div>
      ) : null}

      <div className="w-full max-w-2xl">
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
          <div className="rounded-[1.75rem] border border-border/80 bg-card p-5 shadow-md">
            <Skeleton className="mb-4 h-24 w-full rounded-xl" />
            <div className="flex items-center justify-between">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-40 rounded-full" />
                <Skeleton className="size-8 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          <PromptComposer onContinue={handleContinue} />
        )}
      </div>
    </div>
  )
}
