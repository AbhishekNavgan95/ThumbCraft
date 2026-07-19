import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ImageIcon,
  Link2,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { ChatComposer } from "@/components/generation/ChatComposer"
import { Button } from "@/components/ui/button"
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

/** Fixed thumbnail frame in chat. */
const THUMB_FRAME = "aspect-[5/3] w-full max-w-[390px]"

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

async function fetchImageBlob(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to fetch image")
  return response.blob()
}

async function blobAsPng(blob: Blob) {
  if (blob.type === "image/png") return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not prepare image")
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (png) => (png ? resolve(png) : reject(new Error("Could not convert image"))),
      "image/png",
    )
  })
}

async function copyImageToClipboard(url: string) {
  const blob = await fetchImageBlob(url)
  const png = await blobAsPng(blob)
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": png }),
  ])
}

async function downloadImage(url: string) {
  const blob = await fetchImageBlob(url)
  const extension = blob.type.split("/")[1]?.split("+")[0] || "png"
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = `thumbnail-${Date.now()}.${extension}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

async function copyImageUrl(url: string) {
  await navigator.clipboard.writeText(url)
}

type ImageActionKind = "copy-image" | "download" | "copy-url"

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

function useImageActions(url: string) {
  const [busy, setBusy] = useState<ImageActionKind | null>(null)
  const [done, setDone] = useState<ImageActionKind | null>(null)
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current)
    }
  }, [])

  const run = async (kind: ImageActionKind, action: () => Promise<void>) => {
    if (busy) return
    setBusy(kind)
    try {
      await action()
      setDone(kind)
      if (doneTimer.current) clearTimeout(doneTimer.current)
      doneTimer.current = setTimeout(() => setDone(null), 1600)
    } catch {
      const messages: Record<ImageActionKind, string> = {
        "copy-image": "Could not copy image",
        download: "Could not download image",
        "copy-url": "Could not copy URL",
      }
      toast.error(messages[kind])
    } finally {
      setBusy(null)
    }
  }

  return {
    busy,
    done,
    copyImage: () => run("copy-image", () => copyImageToClipboard(url)),
    download: () => run("download", () => downloadImage(url)),
    copyUrl: () => run("copy-url", () => copyImageUrl(url)),
  }
}

function ActionIcon({
  kind,
  busy,
  done,
}: {
  kind: ImageActionKind
  busy: ImageActionKind | null
  done: ImageActionKind | null
}) {
  if (busy === kind) return <Loader2 className="animate-spin" />
  if (done === kind) return <Check />
  if (kind === "copy-image") return <Copy />
  if (kind === "download") return <Download />
  return <Link2 />
}

function ImageHoverActions({ url }: { url: string }) {
  const actions = useImageActions(url)

  return (
    <div
      className={cn(
        "absolute right-2 bottom-2 z-10 flex gap-1 rounded-xl bg-black/70 p-1 shadow-lg backdrop-blur-sm",
        "opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
      )}
    >
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        className="bg-white text-foreground hover:bg-white/90"
        aria-label="Copy image"
        title="Copy image"
        disabled={Boolean(actions.busy)}
        onClick={(event) => {
          event.stopPropagation()
          void actions.copyImage()
        }}
      >
        <ActionIcon kind="copy-image" busy={actions.busy} done={actions.done} />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        className="bg-white text-foreground hover:bg-white/90"
        aria-label="Download image"
        title="Download"
        disabled={Boolean(actions.busy)}
        onClick={(event) => {
          event.stopPropagation()
          void actions.download()
        }}
      >
        <ActionIcon kind="download" busy={actions.busy} done={actions.done} />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        className="bg-white text-foreground hover:bg-white/90"
        aria-label="Copy image URL"
        title="Copy URL"
        disabled={Boolean(actions.busy)}
        onClick={(event) => {
          event.stopPropagation()
          void actions.copyUrl()
        }}
      >
        <ActionIcon kind="copy-url" busy={actions.busy} done={actions.done} />
      </Button>
    </div>
  )
}

function ImagePreviewActions({ url }: { url: string }) {
  const actions = useImageActions(url)

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        type="button"
        disabled={Boolean(actions.busy)}
        onClick={() => void actions.copyImage()}
      >
        <ActionIcon kind="copy-image" busy={actions.busy} done={actions.done} />
        Copy image
      </Button>
      <Button
        type="button"
        disabled={Boolean(actions.busy)}
        onClick={() => void actions.download()}
      >
        <ActionIcon kind="download" busy={actions.busy} done={actions.done} />
        Download
      </Button>
      <Button
        type="button"
        disabled={Boolean(actions.busy)}
        onClick={() => void actions.copyUrl()}
      >
        <ActionIcon kind="copy-url" busy={actions.busy} done={actions.done} />
        Copy URL
      </Button>
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
        <div
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs",
            THUMB_FRAME,
          )}
        >
          <button
            type="button"
            onClick={() => onPreview(message.imageUrl!)}
            className="absolute inset-0 block size-full text-left transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Preview generated thumbnail"
          >
            <img
              src={message.imageUrl}
              alt="Generated thumbnail"
              width={390}
              height={234}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </button>
          <ImageHoverActions url={message.imageUrl} />
        </div>
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
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
                <img
                  src={previewUrl}
                  alt="Generated thumbnail preview"
                  className="max-h-[75vh] w-full object-contain"
                />
              </div>
              <ImagePreviewActions url={previewUrl} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
