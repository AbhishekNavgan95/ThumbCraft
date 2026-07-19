import { useEffect, useId, useRef, type ClipboardEvent } from "react"
import { ArrowUp, ImagePlus, Loader2, Plus, X } from "lucide-react"
import { ComposerOptionSelect } from "@/components/generation/ComposerOptionSelect"
import { EnhancePromptControl } from "@/components/generation/EnhancePromptControl"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getClipboardImageFiles } from "@/lib/clipboard-images"
import { useGenerationStore } from "@/stores/generation-store"

type PromptComposerProps = {
  onContinue: () => void
  className?: string
}

export function PromptComposer({ onContinue, className }: PromptComposerProps) {
  const fileInputId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mode = useGenerationStore((state) => state.mode)
  const prompt = useGenerationStore((state) => state.prompt)
  const setPrompt = useGenerationStore((state) => state.setPrompt)
  const modelId = useGenerationStore((state) => state.modelId)
  const setModelId = useGenerationStore((state) => state.setModelId)
  const aspectRatio = useGenerationStore((state) => state.aspectRatio)
  const setAspectRatio = useGenerationStore((state) => state.setAspectRatio)
  const resolution = useGenerationStore((state) => state.resolution)
  const setResolution = useGenerationStore((state) => state.setResolution)
  const models = useGenerationStore((state) => state.models)
  const isLoadingModels = useGenerationStore((state) => state.isLoadingModels)
  const references = useGenerationStore((state) => state.references)
  const addReferenceFiles = useGenerationStore(
    (state) => state.addReferenceFiles,
  )
  const removeReference = useGenerationStore((state) => state.removeReference)

  const selectedModel = models.find((model) => model.id === modelId) ?? null

  useEffect(() => {
    if (models.length === 0 || isLoadingModels) return
    if (modelId && models.some((model) => model.id === modelId)) return
    const fallback = models[0]
    if (fallback) setModelId(fallback.id)
  }, [isLoadingModels, modelId, models, setModelId])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [prompt])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const isUploading = references.some((ref) => ref.status === "uploading")
  const hasReadyReference = references.some(
    (ref) => ref.status === "ready" && ref.remoteUrl,
  )

  const canSubmit =
    prompt.trim().length > 0 &&
    Boolean(selectedModel) &&
    Boolean(aspectRatio) &&
    Boolean(resolution) &&
    Boolean(selectedModel?.supportedAspectRatios.includes(aspectRatio)) &&
    Boolean(selectedModel?.supportedResolutions.includes(resolution)) &&
    !isUploading &&
    (mode !== "image" || hasReadyReference)

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (references.length >= 6) return
    const images = getClipboardImageFiles(event.clipboardData)
    if (images.length === 0) return
    event.preventDefault()
    void addReferenceFiles(images)
  }

  const modelOptions = models.map((model) => ({
    value: model.id,
    label: model.title,
    description: model.description || undefined,
  }))

  const aspectOptions =
    selectedModel?.supportedAspectRatios.map((value) => ({
      value,
      label: value,
    })) ?? []

  const resolutionOptions =
    selectedModel?.supportedResolutions.map((value) => ({
      value,
      label: value,
    })) ?? []

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "rounded-3xl border border-border/70 bg-card/95 shadow-lg backdrop-blur-sm",
          "ring-1 ring-black/3 transition-[box-shadow,ring-color]",
          "focus-within:shadow-xl focus-within:ring-primary/20",
        )}
      >
        {references.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-b border-border/50 px-4 pt-4 pb-3">
            {references.map((ref) => (
              <div
                key={ref.id}
                className={cn(
                  "group relative size-14 overflow-hidden rounded-2xl border bg-muted",
                  ref.status === "error"
                    ? "border-destructive/50"
                    : "border-border/80",
                )}
                title={ref.error ?? ref.fileName}
              >
                <img
                  src={ref.previewUrl}
                  alt={ref.fileName}
                  className={cn(
                    "size-full object-cover",
                    ref.status === "uploading" && "opacity-50",
                  )}
                />
                {ref.status === "uploading" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                    <Loader2
                      className="size-4 animate-spin text-foreground"
                      strokeWidth={2.5}
                    />
                  </div>
                ) : null}
                {ref.status === "error" ? (
                  <div className="absolute inset-x-0 bottom-0 bg-destructive/90 px-0.5 py-0.5 text-center text-[9px] leading-none text-destructive-foreground">
                    Failed
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeReference(ref.id)}
                  className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${ref.fileName}`}
                >
                  <X className="size-3" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <label className="sr-only" htmlFor={`${fileInputId}-prompt`}>
          Prompt
        </label>
        <textarea
          id={`${fileInputId}-prompt`}
          ref={textareaRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (canSubmit) onContinue()
            }
          }}
          onPaste={handlePaste}
          placeholder={
            mode === "image"
              ? "Describe the transformation you want…"
              : "Describe the thumbnail you want the agent to create…"
          }
          rows={4}
          className={cn(
            "block w-full resize-none bg-transparent px-5 pt-5 pb-3",
            "text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/80",
            "outline-none",
          )}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-3 py-3">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(event) => {
                void addReferenceFiles(event.target.files ?? [])
                event.target.value = ""
              }}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  disabled={references.length >= 6}
                  aria-label="Add"
                >
                  <Plus className="size-4" strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={8}>
                <DropdownMenuItem
                  className="gap-2 text-sm"
                  onSelect={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="size-3.5" />
                  Upload image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <EnhancePromptControl prompt={prompt} onAccept={setPrompt} />
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            <ComposerOptionSelect
              label="Model"
              value={selectedModel?.id ?? ""}
              disabled={isLoadingModels}
              emptyLabel={isLoadingModels ? "Loading…" : "Model"}
              options={modelOptions}
              onChange={setModelId}
              className="max-w-[11rem]"
              contentClassName="w-72"
            />
            <ComposerOptionSelect
              label="Aspect ratio"
              value={aspectRatio}
              emptyLabel="Ratio"
              options={aspectOptions}
              onChange={setAspectRatio}
              className="max-w-[6.5rem]"
            />
            <ComposerOptionSelect
              label="Resolution"
              value={resolution}
              emptyLabel="Resolution"
              options={resolutionOptions}
              onChange={setResolution}
              className="max-w-[6.5rem]"
            />

            <Button
              type="button"
              size="icon-sm"
              className="ml-0.5 rounded-full"
              disabled={!canSubmit}
              onClick={onContinue}
              aria-label="Continue"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Enter to continue · Shift+Enter for a new line
      </p>
    </div>
  )
}
