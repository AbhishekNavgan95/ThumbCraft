import { Route, Routes } from "react-router-dom"
import { AppLayout } from "@/app/AppLayout"
import { CategoryTemplatesPage } from "@/pages/CategoryTemplatesPage"
import { HomePage } from "@/pages/HomePage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { WalletPage } from "@/pages/WalletPage"

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="gallery/:categoryId" element={<CategoryTemplatesPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
