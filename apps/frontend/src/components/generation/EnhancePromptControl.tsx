import { useState } from "react"
import { Check, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useWalletStore } from "@/stores/wallet-store"

type EnhancePromptControlProps = {
  prompt: string
  disabled?: boolean
  onAccept: (enhancedPrompt: string) => void
  className?: string
}

function EnhancePromptSkeleton() {
  return (
    <div
      className="space-y-2 py-1"
      role="status"
      aria-label="Enhancing prompt"
    >
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[92%]" />
      <Skeleton className="h-3 w-[78%]" />
      <Skeleton className="h-3 w-[85%]" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function EnhancePromptControl({
  prompt,
  disabled = false,
  onAccept,
  className,
}: EnhancePromptControlProps) {
  const [open, setOpen] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhanced, setEnhanced] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasPrompt = prompt.trim().length > 0
  const canOpen = hasPrompt && !disabled

  const reset = () => {
    setEnhanced(null)
    setError(null)
    setIsEnhancing(false)
  }

  const runEnhance = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || disabled) return

    setIsEnhancing(true)
    setEnhanced(null)
    setError(null)

    try {
      const { data } = await api.enhance.prompt(
        { prompt: trimmed },
        crypto.randomUUID(),
      )
      setEnhanced(data.enhancedPrompt)
      void useWalletStore.getState().refresh()
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to enhance prompt"))
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false)
      reset()
      return
    }
    if (!canOpen) return
    setOpen(true)
    void runEnhance()
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground",
            className,
          )}
          disabled={!hasPrompt || disabled}
          aria-label="Enhance prompt"
        >
          <Sparkles
            className={cn("size-3.5", isEnhancing && "animate-pulse")}
            strokeWidth={2}
          />
          Enhance
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[min(100vw-2rem,22rem)] p-3"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <p className="mb-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Enhanced prompt
        </p>

        {isEnhancing ? (
          <EnhancePromptSkeleton />
        ) : error ? (
          <p className="py-2 text-xs text-destructive">{error}</p>
        ) : enhanced ? (
          <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {enhanced}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => handleOpenChange(false)}
          >
            <X className="size-3" />
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!enhanced || isEnhancing}
            onClick={() => {
              if (!enhanced) return
              onAccept(enhanced)
              handleOpenChange(false)
            }}
          >
            <Check className="size-3" />
            Accept
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
