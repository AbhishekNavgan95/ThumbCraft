import { create } from "zustand"
import { api, getApiErrorMessage } from "@/lib/api-client"
import type {
  GenerateStartMode,
  GenerationModel,
  GenerationStep,
  ReferenceImage,
  ThumbnailPreferences,
} from "@/types/generation"

const MAX_REFERENCES = 6

type GenerationState = {
  mode: GenerateStartMode
  step: GenerationStep
  prompt: string
  modelId: string | null
  aspectRatio: string
  resolution: string
  sessionId: string | null
  references: ReferenceImage[]
  preferences: ThumbnailPreferences

  models: GenerationModel[]
  isLoadingModels: boolean
  modelsError: string | null

  startFlow: (mode: GenerateStartMode) => void
  reset: () => void
  setPrompt: (prompt: string) => void
  setModelId: (modelId: string) => void
  setAspectRatio: (aspectRatio: string) => void
  setResolution: (resolution: string) => void
  setPreference: <K extends keyof ThumbnailPreferences>(
    key: K,
    value: ThumbnailPreferences[K],
  ) => void
  patchPreferences: (patch: Partial<ThumbnailPreferences>) => void
  setStep: (step: GenerationStep) => void
  setSessionId: (sessionId: string | null) => void
  clearReferences: () => void
  hydrateComposer: (input: {
    modelId?: string | null
    aspectRatio?: string | null
    resolution?: string | null
    preferences?: ThumbnailPreferences
    clearPrompt?: boolean
    clearReferences?: boolean
  }) => void
  loadModels: () => Promise<void>
  addReferenceFiles: (files: FileList | File[]) => Promise<void>
  removeReference: (id: string) => void
  commitPromptStep: () => boolean
}

function firstOption(options: string[]) {
  return options[0] ?? ""
}

/** Prefer 1K when available — 512 is valid but a weak default for thumbnails. */
function preferredResolution(options: string[], preferred = "") {
  if (preferred && options.includes(preferred)) return preferred
  if (options.includes("1K")) return "1K"
  return firstOption(options)
}

function applyModelDefaults(
  model: GenerationModel | null,
  preferredAspect = "",
  preferredResolutionValue = "",
) {
  if (!model) {
    return { aspectRatio: "", resolution: "" }
  }

  const aspectRatio = model.supportedAspectRatios.includes(preferredAspect)
    ? preferredAspect
    : firstOption(model.supportedAspectRatios)

  const resolution = preferredResolution(
    model.supportedResolutions,
    preferredResolutionValue,
  )

  return { aspectRatio, resolution }
}

function revokePreview(ref: ReferenceImage) {
  if (ref.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(ref.previewUrl)
  }
}

const initialContext = {
  mode: "prompt" as GenerateStartMode,
  step: "prompt" as GenerationStep,
  prompt: "",
  modelId: null as string | null,
  aspectRatio: "",
  resolution: "",
  sessionId: null as string | null,
  references: [] as ReferenceImage[],
  preferences: {} as ThumbnailPreferences,
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  ...initialContext,
  models: [],
  isLoadingModels: false,
  modelsError: null,

  startFlow: (mode) => {
    const { references } = get()
    for (const ref of references) revokePreview(ref)
    set({
      ...initialContext,
      mode,
      step: "prompt",
      models: get().models,
      isLoadingModels: get().isLoadingModels,
      modelsError: get().modelsError,
    })

    const { models, modelId, aspectRatio, resolution } = get()
    const selected =
      models.find((model) => model.id === modelId) ?? models[0] ?? null
    if (!selected) return

    const defaults = applyModelDefaults(selected, aspectRatio, resolution)
    set({
      modelId: selected.id,
      aspectRatio: defaults.aspectRatio,
      resolution: defaults.resolution,
    })
  },

  reset: () => {
    const { references } = get()
    for (const ref of references) revokePreview(ref)
    set({
      ...initialContext,
      models: [],
      isLoadingModels: false,
      modelsError: null,
    })
  },

  setPrompt: (prompt) => set({ prompt }),

  setModelId: (modelId) => {
    const model = get().models.find((item) => item.id === modelId) ?? null
    const defaults = applyModelDefaults(
      model,
      get().aspectRatio,
      get().resolution,
    )
    set({
      modelId,
      aspectRatio: defaults.aspectRatio,
      resolution: defaults.resolution,
    })
  },

  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setResolution: (resolution) => set({ resolution }),

  setPreference: (key, value) =>
    set((state) => ({
      preferences: { ...state.preferences, [key]: value },
    })),

  patchPreferences: (patch) =>
    set((state) => {
      const next: ThumbnailPreferences = { ...state.preferences }
      ;(Object.keys(patch) as Array<keyof ThumbnailPreferences>).forEach(
        (key) => {
          const value = patch[key]
          if (value === undefined) {
            delete next[key]
          } else {
            Object.assign(next, { [key]: value })
          }
        },
      )
      return { preferences: next }
    }),

  setStep: (step) => set({ step }),
  setSessionId: (sessionId) => set({ sessionId }),

  clearReferences: () => {
    const { references } = get()
    for (const ref of references) revokePreview(ref)
    set({ references: [] })
  },

  hydrateComposer: (input) => {
    const { models } = get()
    const preferredModelId = input.modelId ?? get().modelId
    const selected =
      models.find((model) => model.id === preferredModelId) ??
      models[0] ??
      null

    const defaults = applyModelDefaults(
      selected,
      input.aspectRatio ?? get().aspectRatio,
      input.resolution ?? get().resolution,
    )

    if (input.clearReferences) {
      const { references } = get()
      for (const ref of references) revokePreview(ref)
    }

    set({
      ...(input.clearPrompt ? { prompt: "" } : {}),
      ...(input.clearReferences ? { references: [] } : {}),
      ...(input.preferences !== undefined
        ? { preferences: input.preferences }
        : {}),
      modelId: selected?.id ?? preferredModelId ?? null,
      aspectRatio: defaults.aspectRatio || (input.aspectRatio ?? ""),
      resolution: defaults.resolution || (input.resolution ?? ""),
    })
  },

  loadModels: async () => {
    set({ isLoadingModels: true, modelsError: null })
    try {
      const { data } = await api.models.list()
      const models = data.models.filter((model) => model.visible !== false)
      const currentId = get().modelId
      const selected =
        models.find((model) => model.id === currentId) ?? models[0] ?? null
      const defaults = applyModelDefaults(
        selected,
        get().aspectRatio,
        get().resolution,
      )

      set({
        models,
        isLoadingModels: false,
        modelsError: null,
        modelId: selected?.id ?? null,
        aspectRatio: defaults.aspectRatio,
        resolution: defaults.resolution,
      })
    } catch (error) {
      set({
        models: [],
        isLoadingModels: false,
        modelsError: getApiErrorMessage(error, "Failed to load models"),
        modelId: null,
        aspectRatio: "",
        resolution: "",
      })
    }
  },

  addReferenceFiles: async (files) => {
    const list = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    )
    if (list.length === 0) return

    const room = MAX_REFERENCES - get().references.length
    if (room <= 0) return

    const batch = list.slice(0, room).map((file) => {
      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      return {
        file,
        entry: {
          id,
          previewUrl,
          remoteUrl: null,
          key: null,
          fileName: file.name,
          status: "uploading" as const,
        } satisfies ReferenceImage,
      }
    })

    set((state) => ({
      references: [...state.references, ...batch.map((item) => item.entry)],
    }))

    const sessionId = get().sessionId ?? undefined

    await Promise.all(
      batch.map(async ({ file, entry }) => {
        try {
          const { data } = await api.uploads.reference(file, sessionId)
          set((state) => ({
            references: state.references.map((ref) => {
              if (ref.id !== entry.id) return ref
              if (ref.previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(ref.previewUrl)
              }
              return {
                ...ref,
                previewUrl: data.url,
                remoteUrl: data.url,
                key: data.key,
                status: "ready",
                error: undefined,
              }
            }),
          }))
        } catch (error) {
          set((state) => ({
            references: state.references.map((ref) =>
              ref.id === entry.id
                ? {
                    ...ref,
                    status: "error",
                    error: getApiErrorMessage(error, "Upload failed"),
                  }
                : ref,
            ),
          }))
        }
      }),
    )
  },

  removeReference: (id) => {
    const target = get().references.find((ref) => ref.id === id)
    if (target) revokePreview(target)
    set((state) => ({
      references: state.references.filter((ref) => ref.id !== id),
    }))
  },

  commitPromptStep: () => {
    const state = get()
    const prompt = state.prompt.trim()
    const hasReadyReference = state.references.some(
      (ref) => ref.status === "ready" && ref.remoteUrl,
    )
    const uploading = state.references.some((ref) => ref.status === "uploading")

    if (!prompt || !state.modelId || !state.aspectRatio || !state.resolution) {
      return false
    }
    if (uploading) return false
    if (state.mode === "image" && !hasReadyReference) return false

    set({ prompt, step: "preferences" })
    return true
  },
}))
