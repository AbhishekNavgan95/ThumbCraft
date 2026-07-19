import { create } from "zustand"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { useGenerationStore } from "@/stores/generation-store"
import type {
  GenerationMessage,
  GenerationSession,
  ThumbnailPreferences,
} from "@/types/generation"

type ChatState = {
  sessions: GenerationSession[]
  isLoadingSessions: boolean
  sessionsError: string | null

  activeSessionId: string | null
  messages: GenerationMessage[]
  isLoadingMessages: boolean
  messagesError: string | null

  activeJobId: string | null
  isStartingGeneration: boolean
  generationError: string | null

  loadSessions: () => Promise<void>
  renameSession: (sessionId: string, title: string) => Promise<boolean>
  selectSession: (sessionId: string) => Promise<void>
  startGenerationFromContext: () => Promise<string | null>
  continueGeneration: (prompt: string) => Promise<boolean>
  resetChat: () => void
}

function findLastUserMessage(messages: GenerationMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role === "user") return message
  }
  return null
}

function findLastCompletedAssistant(messages: GenerationMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (
      message?.role === "assistant" &&
      message.status === "completed" &&
      message.imageUrl
    ) {
      return message
    }
  }
  return null
}

function sanitizePreferences(
  value: unknown,
): ThumbnailPreferences | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  const raw = value as Record<string, unknown>
  const next: ThumbnailPreferences = {}
  const stringKeys = [
    "niche",
    "mood",
    "visualStyle",
    "primaryColor",
    "backgroundStyle",
    "lighting",
    "composition",
    "faceEmphasis",
    "textStyle",
    "textContent",
  ] as const

  for (const key of stringKeys) {
    const item = raw[key]
    if (typeof item === "string" && item.trim()) {
      next[key] = item.trim()
    }
  }

  if (raw.includeText === true || raw.includeText === false) {
    next.includeText = raw.includeText
  } else if (raw.includeText === "Yes" || raw.includeText === "No") {
    next.includeText = raw.includeText
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function resolveComposerSettings(messages: GenerationMessage[]) {
  const context = useGenerationStore.getState()
  const models = context.models
  const lastUser = findLastUserMessage(messages)

  const model =
    models.find((item) => item.id === context.modelId) ??
    models.find((item) => item.id === lastUser?.modelId) ??
    models[0] ??
    null

  if (!model) {
    return null
  }

  const aspectRatio = model.supportedAspectRatios.includes(context.aspectRatio)
    ? context.aspectRatio
    : lastUser?.requiredAspectRatio &&
        model.supportedAspectRatios.includes(lastUser.requiredAspectRatio)
      ? lastUser.requiredAspectRatio
      : (model.supportedAspectRatios[0] ?? "")

  const resolution = model.supportedResolutions.includes(context.resolution)
    ? context.resolution
    : lastUser?.requiredResolution &&
        model.supportedResolutions.includes(lastUser.requiredResolution)
      ? lastUser.requiredResolution
      : model.supportedResolutions.includes("1K")
        ? "1K"
        : (model.supportedResolutions[0] ?? "")

  if (!aspectRatio || !resolution) return null

  // Keep store aligned with the model actually used for this submit.
  if (
    context.modelId !== model.id ||
    context.aspectRatio !== aspectRatio ||
    context.resolution !== resolution
  ) {
    useGenerationStore.setState({
      modelId: model.id,
      aspectRatio,
      resolution,
    })
  }

  return { modelId: model.id, aspectRatio, resolution }
}

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollToken = 0

function clearPoll() {
  pollToken += 1
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function sleep(ms: number, token: number) {
  return new Promise<void>((resolve) => {
    pollTimer = setTimeout(() => {
      pollTimer = null
      resolve()
    }, ms)
    // If token was invalidated during scheduling, still resolve on tick;
    // callers check token after await.
    void token
  })
}

function isJobTerminal(status: string) {
  return status === "captured" || status === "failed" || status === "released"
}

function isMessageTerminal(status: string | undefined) {
  return status === "completed" || status === "failed"
}

function upsertMessage(
  messages: GenerationMessage[],
  next: GenerationMessage,
) {
  const index = messages.findIndex((item) => item.id === next.id)
  if (index === -1) return [...messages, next]
  const copy = messages.slice()
  copy[index] = next
  return copy
}

function findPendingAssistant(messages: GenerationMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (
      message &&
      message.role === "assistant" &&
      (message.status === "queued" || message.status === "processing")
    ) {
      return message
    }
  }
  return null
}

async function pollJobUntilDone(jobId: string, sessionId: string) {
  const token = ++pollToken
  const started = Date.now()
  const timeoutMs = 180_000
  let intervalMs = 1500

  useChatStore.setState({ activeJobId: jobId })

  while (Date.now() - started < timeoutMs) {
    if (token !== pollToken) return

    try {
      const { data } = await api.jobs.get(jobId)
      if (token !== pollToken) return

      const message = data.message
      const jobStatus = data.job.status

      if (message && useChatStore.getState().activeSessionId === sessionId) {
        useChatStore.setState((state) => ({
          messages: upsertMessage(state.messages, message),
        }))
      }

      if (isMessageTerminal(message?.status) || isJobTerminal(jobStatus)) {
        if (token !== pollToken) return
        useChatStore.setState({ activeJobId: null })
        void useChatStore.getState().loadSessions()
        return
      }
    } catch (error) {
      if (token !== pollToken) return
      useChatStore.setState({
        activeJobId: null,
        generationError: getApiErrorMessage(error, "Failed to poll job status"),
      })
      return
    }

    await sleep(intervalMs, token)
    intervalMs = Math.min(intervalMs + 250, 3000)
  }

  if (token !== pollToken) return
  useChatStore.setState({
    activeJobId: null,
    generationError: "Generation timed out. Please try again.",
  })
}

/** Fallback when we only know the assistant message is still processing. */
async function pollSessionMessagesUntilDone(
  sessionId: string,
  assistantMessageId: string,
) {
  const token = ++pollToken
  const started = Date.now()
  const timeoutMs = 180_000
  let intervalMs = 1500

  useChatStore.setState({ activeJobId: `pending:${assistantMessageId}` })

  while (Date.now() - started < timeoutMs) {
    if (token !== pollToken) return

    try {
      const { data } = await api.sessions.messages(sessionId)
      if (token !== pollToken) return
      if (useChatStore.getState().activeSessionId !== sessionId) return

      useChatStore.setState({ messages: data.messages })

      const assistant = data.messages.find(
        (message) => message.id === assistantMessageId,
      )
      if (isMessageTerminal(assistant?.status)) {
        useChatStore.setState({ activeJobId: null })
        void useChatStore.getState().loadSessions()
        return
      }
    } catch (error) {
      if (token !== pollToken) return
      useChatStore.setState({
        activeJobId: null,
        generationError: getApiErrorMessage(
          error,
          "Failed to refresh messages",
        ),
      })
      return
    }

    await sleep(intervalMs, token)
    intervalMs = Math.min(intervalMs + 250, 3000)
  }

  if (token !== pollToken) return
  useChatStore.setState({
    activeJobId: null,
    generationError: "Generation timed out. Please try again.",
  })
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  isLoadingSessions: false,
  sessionsError: null,

  activeSessionId: null,
  messages: [],
  isLoadingMessages: false,
  messagesError: null,

  activeJobId: null,
  isStartingGeneration: false,
  generationError: null,

  loadSessions: async () => {
    set({ isLoadingSessions: true, sessionsError: null })
    try {
      const { data } = await api.sessions.list({
        status: "active",
        limit: 50,
      })
      set({
        sessions: data.sessions,
        isLoadingSessions: false,
        sessionsError: null,
      })
    } catch (error) {
      set({
        isLoadingSessions: false,
        sessionsError: getApiErrorMessage(error, "Failed to load sessions"),
      })
    }
  },

  renameSession: async (sessionId, title) => {
    const trimmed = title.trim()
    const nextTitle = trimmed.length > 0 ? trimmed.slice(0, 120) : null
    const previous = get().sessions.find((session) => session.id === sessionId)
    if (!previous) return false

    // Optimistic update so the sidebar feels instant.
    set({
      sessions: get().sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: nextTitle,
              updatedAt: new Date().toISOString(),
            }
          : session,
      ),
    })

    try {
      const { data } = await api.sessions.update(sessionId, {
        title: nextTitle,
      })
      set({
        sessions: get().sessions.map((session) =>
          session.id === sessionId ? data.session : session,
        ),
      })
      return true
    } catch {
      set({
        sessions: get().sessions.map((session) =>
          session.id === sessionId ? previous : session,
        ),
      })
      return false
    }
  },

  selectSession: async (sessionId) => {
    const prev = get()
    const keepOngoingPoll =
      prev.activeSessionId === sessionId &&
      Boolean(prev.activeJobId) &&
      !String(prev.activeJobId).startsWith("pending:")

    if (!keepOngoingPoll) {
      clearPoll()
    }

    set({
      activeSessionId: sessionId,
      isLoadingMessages: true,
      messagesError: null,
      generationError: null,
      ...(keepOngoingPoll ? {} : { activeJobId: null }),
    })
    useGenerationStore.getState().setSessionId(sessionId)

    try {
      const { data } = await api.sessions.messages(sessionId)
      // Stale response — user already switched sessions.
      if (get().activeSessionId !== sessionId) return

      set({
        messages: data.messages ?? [],
        isLoadingMessages: false,
      })

      const lastUser = findLastUserMessage(data.messages ?? [])
      useGenerationStore.getState().hydrateComposer({
        modelId: lastUser?.modelId,
        aspectRatio: lastUser?.requiredAspectRatio,
        resolution: lastUser?.requiredResolution,
        preferences: sanitizePreferences(lastUser?.preferences),
        clearPrompt: true,
        clearReferences: true,
      })

      if (keepOngoingPoll) {
        // Real job poll is already running for this session.
        return
      }

      const pending = findPendingAssistant(data.messages ?? [])
      if (pending) {
        void pollSessionMessagesUntilDone(sessionId, pending.id)
      }
    } catch (error) {
      if (get().activeSessionId !== sessionId) return
      set({
        messages: [],
        isLoadingMessages: false,
        messagesError: getApiErrorMessage(error, "Failed to load messages"),
      })
    }
  },

  startGenerationFromContext: async () => {
    clearPoll()
    const context = useGenerationStore.getState()
    if (
      !context.prompt.trim() ||
      !context.modelId ||
      !context.aspectRatio ||
      !context.resolution
    ) {
      set({ generationError: "Missing prompt or model settings." })
      return null
    }

    set({
      isStartingGeneration: true,
      generationError: null,
      messages: [],
      activeJobId: null,
    })
    useGenerationStore.getState().setStep("chat")

    try {
      const { data: sessionData } = await api.sessions.create({
        title: context.prompt.trim().slice(0, 60) || "New session",
      })
      const sessionId = sessionData.session.id
      useGenerationStore.getState().setSessionId(sessionId)
      set({ activeSessionId: sessionId })

      const referenceImageUrls = context.references
        .filter((ref) => ref.status === "ready" && ref.remoteUrl)
        .map((ref) => ref.remoteUrl!)

      const { data } = await api.generate.start(
        {
          sessionId,
          originalPrompt: context.prompt.trim(),
          modelId: context.modelId,
          requiredAspectRatio: context.aspectRatio,
          requiredResolution: context.resolution,
          preferences: context.preferences,
          referenceImageUrls:
            referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
        },
        crypto.randomUUID(),
      )

      const jobId = data.job.id
      set({
        activeSessionId: data.session.id || sessionId,
        messages: [data.userMessage, data.assistantMessage],
        activeJobId: jobId,
        isStartingGeneration: false,
        generationError: null,
      })

      void get().loadSessions()
      void pollJobUntilDone(jobId, data.session.id || sessionId)
      return data.session.id || sessionId
    } catch (error) {
      set({
        isStartingGeneration: false,
        activeJobId: null,
        generationError: getApiErrorMessage(
          error,
          "Failed to start generation",
        ),
      })
      return null
    }
  },

  continueGeneration: async (prompt) => {
    const trimmed = prompt.trim()
    if (!trimmed) return false

    const state = get()
    if (
      !state.activeSessionId ||
      state.activeJobId ||
      state.isStartingGeneration
    ) {
      return false
    }

    const settings = resolveComposerSettings(state.messages)
    if (!settings) {
      set({
        generationError: "Choose a model, aspect ratio, and resolution first.",
      })
      return false
    }

    const context = useGenerationStore.getState()
    if (context.references.some((ref) => ref.status === "uploading")) {
      set({ generationError: "Wait for image uploads to finish." })
      return false
    }

    const uploadedRefs = context.references
      .filter((ref) => ref.status === "ready" && ref.remoteUrl)
      .map((ref) => ref.remoteUrl!)

    // For follow-up edits, include the last generated thumbnail so Gemini
    // has the subject ("him") when the user only uploads a new outfit/ref.
    const lastAssistant = findLastCompletedAssistant(state.messages)
    const referenceImageUrls = [
      ...(lastAssistant?.imageUrl &&
      uploadedRefs.length > 0 &&
      !uploadedRefs.includes(lastAssistant.imageUrl)
        ? [lastAssistant.imageUrl]
        : []),
      ...uploadedRefs,
    ]

    clearPoll()
    set({ isStartingGeneration: true, generationError: null })

    const sessionId = state.activeSessionId

    try {
      const { data } = await api.generate.start(
        {
          sessionId,
          originalPrompt: trimmed,
          modelId: settings.modelId,
          requiredAspectRatio: settings.aspectRatio,
          requiredResolution: settings.resolution,
          // Follow-ups use session history; avoid replaying first-turn prefs.
          preferences: sanitizePreferences(context.preferences),
          referenceImageUrls:
            referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
        },
        crypto.randomUUID(),
      )

      if (get().activeSessionId !== sessionId) {
        set({ isStartingGeneration: false })
        return false
      }

      set((prev) => ({
        messages: [
          ...prev.messages,
          data.userMessage,
          data.assistantMessage,
        ],
        activeJobId: data.job.id,
        isStartingGeneration: false,
        generationError: null,
      }))

      useGenerationStore.getState().hydrateComposer({
        clearPrompt: true,
        clearReferences: true,
      })

      void get().loadSessions()
      void pollJobUntilDone(data.job.id, sessionId)
      return true
    } catch (error) {
      set({
        isStartingGeneration: false,
        activeJobId: null,
        generationError: getApiErrorMessage(
          error,
          "Failed to continue generation",
        ),
      })
      return false
    }
  },

  resetChat: () => {
    clearPoll()
    set({
      activeSessionId: null,
      messages: [],
      isLoadingMessages: false,
      messagesError: null,
      activeJobId: null,
      isStartingGeneration: false,
      generationError: null,
    })
  },
}))
