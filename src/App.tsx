import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LoadingState } from './components/LoadingState'
import { AdminPage } from './pages/AdminPage'
import { AddressesPage } from './pages/AddressesPage'
import { AgentConsolePage } from './pages/AgentConsolePage'
import { CartPage } from './pages/CartPage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrdersPage } from './pages/OrdersPage'
import { PaymentPage } from './pages/PaymentPage'
import { ProductPage } from './pages/ProductPage'
import { ProfilePage } from './pages/ProfilePage'
import { ReviewsPage } from './pages/ReviewsPage'
import { ServicePage } from './pages/ServicePage'
import { CartProvider } from './state/CartContext'
import { AuthProvider, useAuth } from './state/AuthContext'
import { ToastProvider } from './state/ToastContext'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="正在同步登录状态" />
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState label="正在同步登录状态" />
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  if (user.role !== 'ADMIN' && user.role !== 'admin') {
    return <Navigate to="/profile" replace />
  }
  return <>{children}</>
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/catalog" element={<CatalogPage />} />
                <Route path="/product/:productId" element={<ProductPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/cart"
                  element={
                    <RequireAuth>
                      <CartPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <RequireAuth>
                      <CheckoutPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/payment/:orderId"
                  element={
                    <RequireAuth>
                      <PaymentPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <RequireAuth>
                      <OrdersPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders/:orderId"
                  element={
                    <RequireAuth>
                      <OrderDetailPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/reviews"
                  element={
                    <RequireAuth>
                      <ReviewsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <ProfilePage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/addresses"
                  element={
                    <RequireAuth>
                      <AddressesPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/service"
                  element={
                    <RequireAuth>
                      <ServicePage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/favorites"
                  element={
                    <RequireAuth>
                      <FavoritesPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/history"
                  element={
                    <RequireAuth>
                      <HistoryPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <AdminPage />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/service"
                  element={
                    <RequireAdmin>
                      <AgentConsolePage />
                    </RequireAdmin>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
