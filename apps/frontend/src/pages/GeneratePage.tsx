import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { PreferenceQuestionnaire } from "@/components/generation/PreferenceQuestionnaire"
import { PromptComposer } from "@/components/generation/PromptComposer"
import { SiteHeader } from "@/components/home/SiteHeader"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth-store"
import { useGenerationStore } from "@/stores/generation-store"
import type { GenerateStartMode } from "@/types/generation"

function parseMode(value: string | null): GenerateStartMode {
  return value === "image" ? "image" : "prompt"
}

export function GeneratePage() {
  const [searchParams] = useSearchParams()
  const mode = parseMode(searchParams.get("mode"))

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping)
  const openAuthDrawer = useAuthStore((state) => state.openAuthDrawer)

  const storeMode = useGenerationStore((state) => state.mode)
  const step = useGenerationStore((state) => state.step)
  const models = useGenerationStore((state) => state.models)
  const isLoadingModels = useGenerationStore((state) => state.isLoadingModels)
  const modelsError = useGenerationStore((state) => state.modelsError)
  const startFlow = useGenerationStore((state) => state.startFlow)
  const loadModels = useGenerationStore((state) => state.loadModels)
  const commitPromptStep = useGenerationStore((state) => state.commitPromptStep)
  const setStep = useGenerationStore((state) => state.setStep)

  useEffect(() => {
    if (storeMode !== mode) {
      startFlow(mode)
    }
  }, [mode, startFlow, storeMode])

  useEffect(() => {
    if (isBootstrapping) return
    if (!isAuthenticated) {
      openAuthDrawer("signup")
      return
    }
    void loadModels()
  }, [isAuthenticated, isBootstrapping, loadModels, openAuthDrawer])

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
    setStep("generating")
    const snapshot = useGenerationStore.getState()
    console.info("[generate] preferences complete", {
      mode: snapshot.mode,
      prompt: snapshot.prompt,
      modelId: snapshot.modelId,
      aspectRatio: snapshot.aspectRatio,
      resolution: snapshot.resolution,
      referenceImageUrls: snapshot.references
        .filter((ref) => ref.status === "ready" && ref.remoteUrl)
        .map((ref) => ref.remoteUrl),
      preferences: snapshot.preferences,
      step: snapshot.step,
    })
    toast.success("Preferences saved", {
      description: "Generation comes next — hang tight.",
    })
  }

  const showQuestionnaire = step === "preferences"
  const showGenerating = step === "generating"

  return (
    <div className="relative isolate flex min-h-svh w-full flex-col bg-background">
      <SiteHeader />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        <main className="flex flex-1 flex-col items-center justify-center py-8 sm:py-10">
          {!showQuestionnaire && !showGenerating ? (
            <div className="mb-8 w-full space-y-2 text-center sm:mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {mode === "image"
                  ? "Start from an image"
                  : "Start from a prompt"}
              </h1>
              <p className="mx-auto text-sm text-muted-foreground sm:text-base">
                {mode === "image"
                  ? "Attach a reference, pick a model, then describe the cover you want."
                  : "Describe the thumbnail, choose a model and framing, then continue."}
              </p>
            </div>
          ) : null}

          <div className="mx-auto w-full max-w-2xl">
            {!isAuthenticated && !isBootstrapping ? (
              <div className="rounded-2xl border border-border bg-card/80 px-5 py-8 text-center shadow-xs">
                <p className="text-sm text-muted-foreground">
                  Sign in to start generating thumbnails.
                </p>
                <Button
                  className="mt-4 rounded-full"
                  onClick={() => openAuthDrawer("signup")}
                >
                  Sign up to continue
                </Button>
              </div>
            ) : showGenerating ? (
              <div className="rounded-2xl border border-border bg-card/90 px-5 py-10 text-center shadow-xs">
                <p className="text-base font-medium text-foreground">
                  Preferences locked in
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generation will start from here in the next step.
                </p>
                <Button
                  variant="outline"
                  className="mt-5 rounded-full"
                  onClick={() => setStep("preferences")}
                >
                  Review preferences
                </Button>
              </div>
            ) : showQuestionnaire ? (
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
        </main>
      </div>
    </div>
  )
}
