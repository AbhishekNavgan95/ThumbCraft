import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { AppLayout } from "@/app/AppLayout"
import { DashboardLayout } from "@/app/DashboardLayout"
import { CategoryTemplatesPage } from "@/pages/CategoryTemplatesPage"
import { HomePage } from "@/pages/HomePage"
import { NewChatPage } from "@/pages/NewChatPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { SessionChatPage } from "@/pages/SessionChatPage"
import { WalletConfirmPage } from "@/pages/WalletConfirmPage"

function RedirectPreserveSearch({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search}`} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="gallery/:categoryId" element={<CategoryTemplatesPage />} />
        <Route
          path="generate"
          element={<RedirectPreserveSearch to="/dashboard/new" />}
        />

        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate to="new" replace />} />
          <Route path="new" element={<NewChatPage />} />
          <Route path="sessions/:sessionId" element={<SessionChatPage />} />
          <Route
            path="archived"
            element={<Navigate to="/dashboard/new" replace />}
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="wallet/confirm" element={<WalletConfirmPage />} />
          <Route
            path="wallet"
            element={<Navigate to="/dashboard/profile" replace />}
          />
          <Route
            path="transactions"
            element={<Navigate to="/dashboard/profile" replace />}
          />
        </Route>

        {/* Legacy redirects */}
        <Route
          path="wallet"
          element={<RedirectPreserveSearch to="/dashboard/profile" />}
        />
        <Route
          path="wallet/confirm"
          element={<RedirectPreserveSearch to="/dashboard/wallet/confirm" />}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
