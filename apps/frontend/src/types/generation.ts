export type GenerationModel = {
  id: string
  provider: string
  providerModelId: string
  title: string
  description: string
  supportedAspectRatios: string[]
  supportedResolutions: string[]
  visible: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ModelsResponse = {
  models: GenerationModel[]
}

export type GenerateStartMode = "prompt" | "image"

/** Wizard answers collected after the prompt step (built up over time). */
export type ThumbnailPreferences = {
  niche?: string
  mood?: string
  visualStyle?: string
  primaryColor?: string
  backgroundStyle?: string
  lighting?: string
  composition?: string
  faceEmphasis?: string
  includeText?: boolean | "Yes" | "No"
  textStyle?: string
  textContent?: string
}

export type ReferenceImageStatus = "uploading" | "ready" | "error"

export type ReferenceImage = {
  id: string
  previewUrl: string
  remoteUrl: string | null
  key: string | null
  fileName: string
  status: ReferenceImageStatus
  error?: string
}

export type GenerationStep = "prompt" | "preferences" | "generating"

export type ReferenceUploadResponse = {
  url: string
  key: string
  contentType: string
  size: number
  folder: "references"
}

/** Snapshot of everything needed for generate / later preference steps. */
export type GenerationContext = {
  mode: GenerateStartMode
  step: GenerationStep
  prompt: string
  modelId: string | null
  aspectRatio: string
  resolution: string
  sessionId: string | null
  references: ReferenceImage[]
  preferences: ThumbnailPreferences
}
