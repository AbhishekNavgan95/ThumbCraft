import { useEffect } from "react"
import { useParams } from "react-router-dom"
import { ChatThread } from "@/components/generation/ChatThread"
import { useChatStore } from "@/stores/chat-store"

export function SessionChatPage() {
  const { sessionId = "" } = useParams()
  const selectSession = useChatStore((state) => state.selectSession)

  useEffect(() => {
    if (!sessionId) return
    // Always load by route id so history refreshes when switching sessions.
    void selectSession(sessionId)
  }, [selectSession, sessionId])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatThread />
    </div>
  )
}
