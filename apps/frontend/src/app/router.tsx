import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { AppLayout } from "@/app/AppLayout"
import { DashboardLayout } from "@/app/DashboardLayout"
import { CategoryTemplatesPage } from "@/pages/CategoryTemplatesPage"
import { GeneratePage } from "@/pages/GeneratePage"
import { HomePage } from "@/pages/HomePage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { TransactionsPage } from "@/pages/TransactionsPage"
import { WalletConfirmPage } from "@/pages/WalletConfirmPage"
import { WalletPage } from "@/pages/WalletPage"

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
        <Route path="generate" element={<GeneratePage />} />

        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate to="wallet" replace />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="wallet/confirm" element={<WalletConfirmPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
        </Route>

        {/* Legacy redirects */}
        <Route
          path="wallet"
          element={<RedirectPreserveSearch to="/dashboard/wallet" />}
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
