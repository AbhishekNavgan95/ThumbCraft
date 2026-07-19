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

export type GenerationStep = "prompt" | "preferences" | "chat"

export type ReferenceUploadResponse = {
  url: string
  key: string
  contentType: string
  size: number
  folder: "references"
}

export type SessionStatus = "active" | "archived"

export type GenerationSession = {
  id: string
  userId: string
  title: string | null
  category: string | null
  pinned: boolean
  latestInteractionId: string | null
  latestMessageId: string | null
  latestAssistantMessageId: string | null
  status: SessionStatus
  messageCount: number
  createdAt: string
  updatedAt: string
}

export type ListSessionsResponse = {
  sessions: GenerationSession[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export type CreateSessionResponse = {
  session: GenerationSession
  reused: boolean
}

export type MessageRole = "user" | "assistant"
export type MessageStatus = "queued" | "processing" | "completed" | "failed"

export type GenerationMessage = {
  id: string
  sessionId: string
  role: MessageRole
  modelId: string
  originalPrompt: string | null
  enhancedPrompt: string | null
  usedEnhancedPrompt: boolean
  providerInput: string | null
  preferences: unknown
  referenceImageUrls: string[]
  referenceTemplateIds: string[]
  requiredAspectRatio: string | null
  requiredResolution: string | null
  referenceId: string | null
  imageUrl: string | null
  mimeType: string | null
  width: number | null
  height: number | null
  interactionId: string | null
  status: MessageStatus
  error: string | null
  completedAt: string | null
  metadata: unknown
  createdAt: string
}

export type ListMessagesResponse = {
  messages: GenerationMessage[]
}

export type GenerateRequest = {
  sessionId?: string
  originalPrompt: string
  enhancedPrompt?: string | null
  usedEnhancedPrompt?: boolean
  preferences?: ThumbnailPreferences
  modelId: string
  requiredAspectRatio: string
  requiredResolution: string
  referenceImageUrls?: string[]
  referenceTemplateIds?: string[]
}

export type EnhancePromptRequest = {
  prompt: string
  idempotencyKey?: string
}

export type EnhancePromptResponse = {
  jobId: string
  originalPrompt: string
  enhancedPrompt: string
  coinCost: number
  model: string
  systemPromptKey: string
  systemPromptVersion: string
}

export type GenerateResponse = {
  session: {
    id: string
    latestInteractionId: string | null
    latestMessageId: string | null
    latestAssistantMessageId: string | null
  }
  userMessage: GenerationMessage
  assistantMessage: GenerationMessage
  job: {
    id: string
    status: string
    coinCost: number
    billing: string
  }
  providerInput: string
  isFirstTurn: boolean
}

export type GenerationJobStatus =
  | "created"
  | "reserved"
  | "processing"
  | "captured"
  | "released"
  | "failed"

export type GenerationJob = {
  id: string
  sessionId: string | null
  messageId: string | null
  kind: "generation" | "prompt_enhance"
  status: GenerationJobStatus
  coinCost: number
  error: string | null
  createdAt: string
  completedAt: string | null
}

export type GetJobResponse = {
  job: GenerationJob
  message: GenerationMessage | null
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
