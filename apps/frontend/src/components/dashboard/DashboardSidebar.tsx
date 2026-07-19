import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  ChevronUp,
  Coins,
  LogOut,
  MessageSquarePlus,
  Pencil,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import { useChatStore } from "@/stores/chat-store"
import { useGenerationStore } from "@/stores/generation-store"
import { useWalletStore } from "@/stores/wallet-store"
import type { GenerationSession } from "@/types/generation"

function formatCoins(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value,
  )
}

function formatSessionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date)
}

function sessionLabel(session: GenerationSession) {
  const title = session.title?.trim()
  if (title && title !== "New session") return title
  return "Untitled chat"
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

function SessionRow({
  session,
  isActive,
  onSelect,
}: {
  session: GenerationSession
  isActive: boolean
  onSelect: () => void
}) {
  const renameSession = useChatStore((state) => state.renameSession)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isEditing) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [isEditing])

  const startEditing = () => {
    setDraft(sessionLabel(session))
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setDraft("")
  }

  const commitEditing = async () => {
    if (isSaving) return
    const next = draft.trim()
    const current = sessionLabel(session)
    if (!next || next === current) {
      cancelEditing()
      return
    }

    setIsSaving(true)
    const ok = await renameSession(session.id, next)
    setIsSaving(false)
    if (!ok) {
      toast.error("Failed to rename session")
      inputRef.current?.focus()
      return
    }
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <li>
        <div
          className={cn(
            "flex items-center gap-1 rounded-xl px-2 py-1.5",
            isActive ? "bg-primary/10" : "bg-muted/50",
          )}
        >
          <input
            ref={inputRef}
            value={draft}
            disabled={isSaving}
            maxLength={120}
            aria-label="Rename session"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              void commitEditing()
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void commitEditing()
              }
              if (event.key === "Escape") {
                event.preventDefault()
                cancelEditing()
              }
            }}
            className={cn(
              "min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-medium text-foreground",
              "outline-none ring-1 ring-primary/40 focus:ring-primary/60",
              "disabled:opacity-60",
            )}
          />
        </div>
      </li>
    )
  }

  return (
    <li>
      <div
        className={cn(
          "group relative flex w-full items-center rounded-xl transition-colors",
          isActive
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <button
          type="button"
          title={sessionLabel(session)}
          onClick={onSelect}
          className="min-w-0 flex-1 px-2.5 py-2 text-left"
        >
          <span className="block truncate text-sm font-medium text-foreground">
            {sessionLabel(session)}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {session.messageCount} msg · {formatSessionTime(session.updatedAt)}
          </span>
        </button>
        <button
          type="button"
          aria-label={`Rename ${sessionLabel(session)}`}
          onClick={(event) => {
            event.stopPropagation()
            startEditing()
          }}
          className={cn(
            "mr-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground opacity-0 transition-opacity",
            "hover:bg-background/80 hover:text-foreground",
            "group-hover:opacity-100 focus-visible:opacity-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          <Pencil className="size-3" strokeWidth={2} />
        </button>
      </div>
    </li>
  )
}

type DashboardSidebarProps = {
  className?: string
  collapsed?: boolean
  onNavigate?: () => void
}

export function DashboardSidebar({
  className,
  collapsed = false,
  onNavigate,
}: DashboardSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const balanceCoins = useWalletStore((state) => state.balanceCoins)
  const isWalletLoading = useWalletStore((state) => state.isLoading)
  const refreshWallet = useWalletStore((state) => state.refresh)
  const resetWallet = useWalletStore((state) => state.reset)
  const openBuyDrawer = useWalletStore((state) => state.openBuyDrawer)

  const sessions = useChatStore((state) => state.sessions)
  const isLoadingSessions = useChatStore((state) => state.isLoadingSessions)
  const sessionsError = useChatStore((state) => state.sessionsError)
  const loadSessions = useChatStore((state) => state.loadSessions)
  const resetChat = useChatStore((state) => state.resetChat)

  const startFlow = useGenerationStore((state) => state.startFlow)
  const mode = useGenerationStore((state) => state.mode)

  const [signOutOpen, setSignOutOpen] = useState(false)

  const activeSessionIdFromPath = location.pathname.startsWith(
    "/dashboard/sessions/",
  )
    ? location.pathname.split("/dashboard/sessions/")[1]?.split("/")[0]
    : null

  const isNewChatRoute = location.pathname.startsWith("/dashboard/new")
  const isProfileRoute = location.pathname.startsWith("/dashboard/profile")

  useEffect(() => {
    void refreshWallet()
    void loadSessions()
  }, [loadSessions, refreshWallet])

  const handleNewChat = () => {
    resetChat()
    startFlow(mode || "prompt")
    onNavigate?.()
    navigate(`/dashboard/new?mode=${mode || "prompt"}`)
  }

  const handleSelectSession = (sessionId: string) => {
    onNavigate?.()
    navigate(`/dashboard/sessions/${sessionId}`)
  }

  const handleLogout = () => {
    resetWallet()
    resetChat()
    logout()
    setSignOutOpen(false)
    navigate("/")
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border/70 bg-card/80",
        collapsed ? "w-17" : "w-64",
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2"
          onClick={onNavigate}
        >
          <img
            src="/logo.png"
            alt="Thumbcraft"
            className="h-7 w-auto object-contain"
          />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
        <nav className="space-y-1">
          <button
            type="button"
            onClick={handleNewChat}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
              isNewChatRoute
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <MessageSquarePlus className="size-4 shrink-0" />
            {!collapsed ? <span>New chat</span> : null}
          </button>
        </nav>

        <div className="flex min-h-0 flex-1 flex-col">
          {!collapsed ? (
            <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Sessions
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-border" />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingSessions && sessions.length === 0 ? (
              <div className="space-y-1.5 px-1">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-11 w-full rounded-xl" />
                ))}
              </div>
            ) : sessionsError ? (
              <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5">
                {!collapsed ? (
                  <p className="text-xs text-destructive">{sessionsError}</p>
                ) : null}
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => void loadSessions()}
                >
                  Retry
                </Button>
              </div>
            ) : sessions.length === 0 ? (
              !collapsed ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No sessions yet
                </p>
              ) : null
            ) : collapsed ? (
              <ul className="space-y-0.5">
                {sessions.map((session) => {
                  const isActive = session.id === activeSessionIdFromPath
                  return (
                    <li key={session.id}>
                      <button
                        type="button"
                        title={sessionLabel(session)}
                        onClick={() => handleSelectSession(session.id)}
                        className={cn(
                          "mx-auto flex size-9 items-center justify-center rounded-xl text-[10px] font-semibold transition-colors",
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        {sessionLabel(session).slice(0, 2).toUpperCase()}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <ul className="space-y-0.5">
                {sessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionIdFromPath}
                    onSelect={() => handleSelectSession(session.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-1.5 border-t border-border/60 p-2">
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            openBuyDrawer()
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-muted/60",
            collapsed && "justify-center",
          )}
          aria-label={`${balanceCoins ?? 0} coins — buy coins`}
        >
          <Coins className="size-4 shrink-0 text-primary" />
          {!collapsed ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="font-medium tabular-nums text-foreground">
                Currency balance:
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {isWalletLoading && balanceCoins === null
                  ? "0"
                  : `${formatCoins(balanceCoins ?? 0)}`}
              </span>
            </div>
          ) : null}
        </button>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  collapsed && "justify-center",
                  isProfileRoute && "bg-muted",
                )}
                aria-label="Account menu"
              >
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {initials(user.name)}
                </span>
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {user.name}
                    </span>
                    <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
                  </>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align={collapsed ? "center" : "start"}
              sideOffset={4}
              className={
                collapsed
                  ? "w-44"
                  : "w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)]"
              }
            >
              <DropdownMenuLabel className="px-2 py-1.5 font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="truncate text-xs font-medium text-foreground">
                    {user.name}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs"
                onSelect={() => {
                  onNavigate?.()
                  navigate("/dashboard/profile")
                }}
              >
                <UserRound className="size-3.5" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="gap-2 text-xs"
                onSelect={() => setSignOutOpen(true)}
              >
                <LogOut className="size-3.5" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You’ll need to sign in again to generate thumbnails and manage
              your wallet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleLogout}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
