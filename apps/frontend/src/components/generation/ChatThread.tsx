import { useEffect, useRef, useState } from "react"
import { AlertCircle, ImageIcon, Loader2 } from "lucide-react"
import { ChatComposer } from "@/components/generation/ChatComposer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/stores/chat-store"
import type { GenerationMessage } from "@/types/generation"

/** Fixed 4:3 thumbnail frame in chat. */
const THUMB_FRAME = "h-[270px] w-[360px] max-w-full"

/** Shared column width for thread + composer alignment. */
const CHAT_COLUMN = "mx-auto w-full max-w-3xl"

function formatMessageTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

function MessageHeader({
  label,
  createdAt,
}: {
  label: string
  createdAt: string
}) {
  const time = formatMessageTime(createdAt)
  return (
    <div className="mb-2 flex items-baseline gap-1.5 text-sm text-muted-foreground">
      <span className="font-medium text-foreground/80">{label}</span>
      {time ? (
        <>
          <span aria-hidden className="text-muted-foreground/50">
            ·
          </span>
          <time dateTime={createdAt}>{time}</time>
        </>
      ) : null}
    </div>
  )
}

function GenerationLoader() {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-muted/40",
        THUMB_FRAME,
      )}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="size-14 animate-pulse rounded-2xl bg-primary/15" />
          <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-primary" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-foreground">
            Generating thumbnail…
          </p>
          <p className="text-xs text-muted-foreground">
            This usually takes a few seconds
          </p>
        </div>
      </div>
    </div>
  )
}

function priorAssistantImageUrls(
  messages: GenerationMessage[],
  beforeIndex: number,
) {
  const urls = new Set<string>()
  for (let i = 0; i < beforeIndex; i += 1) {
    const message = messages[i]
    if (message?.role === "assistant" && message.imageUrl) {
      urls.add(message.imageUrl)
    }
  }
  return urls
}

function UserMessage({
  message,
  hideReferenceUrls,
}: {
  message: GenerationMessage
  hideReferenceUrls?: Set<string>
}) {
  const referenceUrls = (message.referenceImageUrls ?? []).filter(
    (url) => !hideReferenceUrls?.has(url),
  )

  return (
    <div className="w-full">
      <MessageHeader label="User" createdAt={message.createdAt} />
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
        {message.originalPrompt ?? "Prompt"}
      </p>
      {referenceUrls.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {referenceUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              className="size-12 rounded-lg object-cover ring-1 ring-border"
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AssistantMessage({
  message,
  isActiveJob,
  onPreview,
}: {
  message: GenerationMessage
  isActiveJob: boolean
  onPreview: (url: string) => void
}) {
  const isPending =
    isActiveJob ||
    message.status === "queued" ||
    message.status === "processing"

  return (
    <div className="w-full">
      <MessageHeader label="Assistant" createdAt={message.createdAt} />
      {isPending ? (
        <GenerationLoader />
      ) : message.status === "failed" ? (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{message.error || "Generation failed"}</p>
        </div>
      ) : message.imageUrl ? (
        <button
          type="button"
          onClick={() => onPreview(message.imageUrl!)}
          className={cn(
            "group relative block overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-xs transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            THUMB_FRAME,
          )}
          aria-label="Preview generated thumbnail"
        >
          <img
            src={message.imageUrl}
            alt="Generated thumbnail"
            width={200}
            height={200}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </button>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Waiting for result…
        </div>
      )}
    </div>
  )
}

type ChatThreadProps = {
  className?: string
}

export function ChatThread({ className }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const messages = useChatStore((state) => state.messages)
  const isLoadingMessages = useChatStore((state) => state.isLoadingMessages)
  const messagesError = useChatStore((state) => state.messagesError)
  const activeJobId = useChatStore((state) => state.activeJobId)
  const isStartingGeneration = useChatStore(
    (state) => state.isStartingGeneration,
  )
  const generationError = useChatStore((state) => state.generationError)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStartingGeneration, activeJobId])

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className={CHAT_COLUMN}>
          {isStartingGeneration && messages.length === 0 ? (
            <div className="flex w-full flex-col gap-8">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-2/3 max-w-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <GenerationLoader />
              </div>
            </div>
          ) : isLoadingMessages && messages.length === 0 ? (
            <div className="flex w-full flex-col gap-8">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-2/3 max-w-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className={cn("rounded-2xl", THUMB_FRAME)} />
              </div>
            </div>
          ) : messagesError ? (
            <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {messagesError}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center">
              <ImageIcon className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Select a session or start a new generation
              </p>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-8">
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <UserMessage
                    key={message.id}
                    message={message}
                    hideReferenceUrls={priorAssistantImageUrls(messages, index)}
                  />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    onPreview={setPreviewUrl}
                    isActiveJob={
                      Boolean(activeJobId) &&
                      (activeJobId === `pending:${message.id}` ||
                        message.status === "processing" ||
                        message.status === "queued")
                    }
                  />
                ),
              )}
              {generationError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {generationError}
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <ChatComposer />

      <Dialog
        open={Boolean(previewUrl)}
        onOpenChange={(open) => {
          if (!open) setPreviewUrl(null)
        }}
      >
        <DialogContent className="border-0 bg-transparent p-0 shadow-none">
          <DialogTitle>Thumbnail preview</DialogTitle>
          <DialogDescription>Full-size generated thumbnail</DialogDescription>
          {previewUrl ? (
            <div className="overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
              <img
                src={previewUrl}
                alt="Generated thumbnail preview"
                className="max-h-[85vh] w-full object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
