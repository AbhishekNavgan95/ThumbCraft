import { useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getVisiblePreferenceFields,
  type PreferenceFieldDefinition,
} from "@/lib/preference-catalog"
import { cn } from "@/lib/utils"
import { useGenerationStore } from "@/stores/generation-store"
import type { ThumbnailPreferences } from "@/types/generation"

type PreferenceQuestionnaireProps = {
  onComplete: () => void
  onBackToPrompt?: () => void
  className?: string
}

function preferenceValue(
  preferences: ThumbnailPreferences,
  field: PreferenceFieldDefinition,
): string {
  const raw = preferences[field.id]
  if (raw === undefined || raw === null) return ""
  if (typeof raw === "boolean") return raw ? "Yes" : "No"
  return raw
}

function TextAnswerStep({
  field,
  initialValue,
  isLast,
  onSkip,
  onSubmit,
}: {
  field: PreferenceFieldDefinition
  initialValue: string
  isLast: boolean
  onSkip: () => void
  onSubmit: (value: string) => void
}) {
  const [textDraft, setTextDraft] = useState(initialValue)

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <Input
        value={textDraft}
        onChange={(event) => setTextDraft(event.target.value)}
        placeholder={field.placeholder}
        className="h-12 rounded-xl px-4 text-base"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onSubmit(textDraft.trim())
          }
        }}
        autoFocus
      />
      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={onSkip}
        >
          Skip
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          onClick={() => onSubmit(textDraft.trim())}
        >
          {isLast ? "Finish" : "Continue"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function PreferenceQuestionnaire({
  onComplete,
  onBackToPrompt,
  className,
}: PreferenceQuestionnaireProps) {
  const prompt = useGenerationStore((state) => state.prompt)
  const preferences = useGenerationStore((state) => state.preferences)
  const setPreference = useGenerationStore((state) => state.setPreference)
  const patchPreferences = useGenerationStore((state) => state.patchPreferences)
  const modelId = useGenerationStore((state) => state.modelId)
  const models = useGenerationStore((state) => state.models)
  const aspectRatio = useGenerationStore((state) => state.aspectRatio)
  const resolution = useGenerationStore((state) => state.resolution)

  const selectedModel =
    models.find((model) => model.id === modelId) ?? models[0] ?? null

  const visibleFields = getVisiblePreferenceFields(preferences)
  const [index, setIndex] = useState(0)

  const total = visibleFields.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0))
  const field = visibleFields[safeIndex]
  const progress = total === 0 ? 100 : ((safeIndex + 1) / total) * 100
  const selected = field ? preferenceValue(preferences, field) : ""

  if (!field) {
    return null
  }

  const advanceFrom = (
    fromIndex: number,
    nextPreferences: ThumbnailPreferences,
  ) => {
    const nextVisible = getVisiblePreferenceFields(nextPreferences)
    const nextIndex = fromIndex + 1
    if (nextIndex >= nextVisible.length) {
      onComplete()
      return
    }
    setIndex(nextIndex)
  }

  const goBack = () => {
    if (safeIndex <= 0) {
      onBackToPrompt?.()
      return
    }
    setIndex((current) => Math.max(current - 1, 0))
  }

  const selectOption = (value: string) => {
    const currentIndex = safeIndex
    let nextPreferences: ThumbnailPreferences = { ...preferences }

    if (field.id === "includeText") {
      if (value === "No") {
        nextPreferences = {
          ...preferences,
          includeText: "No",
        }
        delete nextPreferences.textStyle
        delete nextPreferences.textContent
        patchPreferences({
          includeText: "No",
          textStyle: undefined,
          textContent: undefined,
        })
      } else {
        nextPreferences = { ...preferences, includeText: "Yes" }
        setPreference("includeText", "Yes")
      }
      window.setTimeout(
        () => advanceFrom(currentIndex, nextPreferences),
        120,
      )
      return
    }

    nextPreferences = {
      ...preferences,
      [field.id]: value,
    }
    setPreference(field.id, value as ThumbnailPreferences[typeof field.id])
    window.setTimeout(() => advanceFrom(currentIndex, nextPreferences), 120)
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col items-center gap-6",
        className,
      )}
    >
      <div className="w-full rounded-2xl border border-border/70 bg-card/90 px-4 py-4 text-center shadow-xs sm:px-5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Your prompt
        </p>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground sm:text-[15px]">
          {prompt}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {selectedModel ? (
            <span className="rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
              {selectedModel.title}
            </span>
          ) : null}
          {aspectRatio ? (
            <span className="rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
              {aspectRatio}
            </span>
          ) : null}
          {resolution ? (
            <span className="rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
              {resolution}
            </span>
          ) : null}
        </div>
      </div>

      <div className="w-full space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 rounded-xl text-muted-foreground"
            onClick={goBack}
          >
            <ArrowLeft className="size-4" />
            {safeIndex === 0 ? "Edit prompt" : "Back"}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Question {safeIndex + 1} of {total}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="w-full space-y-2 text-center sm:space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {field.title}
        </h2>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground sm:text-base">
          {field.description}
        </p>
      </div>

      {field.type === "text" ? (
        <TextAnswerStep
          key={field.id}
          field={field}
          initialValue={preferenceValue(preferences, field)}
          isLast={safeIndex >= total - 1}
          onSkip={() => {
            const nextPreferences = { ...preferences }
            delete nextPreferences.textContent
            patchPreferences({ textContent: undefined })
            advanceFrom(safeIndex, nextPreferences)
          }}
          onSubmit={(value) => {
            const nextPreferences: ThumbnailPreferences = { ...preferences }
            if (value) {
              nextPreferences.textContent = value
              setPreference("textContent", value)
            } else {
              delete nextPreferences.textContent
              patchPreferences({ textContent: undefined })
            }
            advanceFrom(safeIndex, nextPreferences)
          }}
        />
      ) : (
        <div className="flex w-full flex-wrap justify-center gap-2 sm:gap-2.5">
          {(field.options ?? []).map((option) => {
            const isSelected = selected === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => selectOption(option)}
                className={cn(
                  "inline-flex min-h-10 min-w-[7.5rem] items-center justify-center rounded-xl border px-3 py-2 text-center text-xs font-medium transition-all sm:min-h-11 sm:min-w-[8.5rem] sm:text-sm",
                  "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border/80 bg-card text-foreground shadow-xs hover:border-primary/40 hover:bg-accent",
                )}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
