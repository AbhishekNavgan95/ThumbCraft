import { create } from "zustand"
import { api, getApiErrorMessage, isApiError } from "@/lib/api-client"
import {
  clearAuthStorage,
  clearPendingEmail,
  getAuthToken,
  getPendingEmail,
  getStoredUser,
  setAuthToken,
  setPendingEmail,
  setStoredUser,
} from "@/lib/auth-token"
import type { AuthView, PublicUser } from "@/types/auth"

type AuthResult = { success: true; message?: string } | { success: false; error: string }

type AuthState = {
  user: PublicUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isBootstrapping: boolean
  error: string | null
  successMessage: string | null
  authDrawerOpen: boolean
  authView: AuthView
  pendingEmail: string | null
  openAuthDrawer: (view?: AuthView) => void
  closeAuthDrawer: () => void
  setAuthView: (view: AuthView) => void
  clearError: () => void
  clearMessages: () => void
  login: (email: string, password: string) => Promise<AuthResult>
  signup: (name: string, email: string, password: string) => Promise<AuthResult>
  verifyOtp: (otp: string) => Promise<AuthResult>
  logout: () => void
  hydrate: () => Promise<void>
  init: () => () => void
}

function persistSession(token: string, user: PublicUser) {
  setAuthToken(token)
  setStoredUser(user)
  clearPendingEmail()
}

function beginOtpVerification(email: string, message: string) {
  setPendingEmail(email)
  return {
    authView: "verify-otp" as const,
    pendingEmail: email.trim().toLowerCase(),
    successMessage: message,
    error: null,
    isLoading: false,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isBootstrapping: true,
  error: null,
  successMessage: null,
  authDrawerOpen: false,
  authView: "login",
  pendingEmail: getPendingEmail(),

  openAuthDrawer: (view = "login") => {
    const pendingEmail = getPendingEmail()
    set({
      authDrawerOpen: true,
      authView: view === "login" && pendingEmail ? "verify-otp" : view,
      pendingEmail,
      error: null,
      successMessage: null,
    })
  },

  closeAuthDrawer: () => {
    set({
      authDrawerOpen: false,
      error: null,
      successMessage: null,
    })
  },

  setAuthView: (view) => {
    set({ authView: view, error: null, successMessage: null })
  },

  clearError: () => set({ error: null }),

  clearMessages: () => set({ error: null, successMessage: null }),

  login: async (email, password) => {
    set({ isLoading: true, error: null, successMessage: null })

    try {
      const { data } = await api.auth.login({ email, password })
      persistSession(data.token, data.user)

      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        authDrawerOpen: false,
        successMessage: data.message,
        error: null,
        pendingEmail: null,
      })

      return { success: true, message: data.message }
    } catch (error) {
      if (
        isApiError(error) &&
        error.status === 403 &&
        /not verified/i.test(error.message)
      ) {
        set(
          beginOtpVerification(
            email,
            "Your email is not verified yet. Enter the 6-digit OTP from your signup email.",
          ),
        )
        return { success: true }
      }

      const errorMessage = getApiErrorMessage(error, "Login failed")
      set({ isLoading: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null, successMessage: null })

    try {
      const { data } = await api.auth.signup({ name, email, password })
      set(beginOtpVerification(data.email, data.message))
      return { success: true, message: data.message }
    } catch (error) {
      const errorMessage = getApiErrorMessage(error, "Signup failed")
      set({ isLoading: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  },

  verifyOtp: async (otp) => {
    const email = get().pendingEmail ?? getPendingEmail()
    if (!email) {
      const errorMessage = "Missing email for OTP verification. Sign up again."
      set({ error: errorMessage, authView: "signup" })
      return { success: false, error: errorMessage }
    }

    set({ isLoading: true, error: null, successMessage: null, pendingEmail: email })

    try {
      const { data } = await api.auth.verifyOtp({ email, otp })
      persistSession(data.token, data.user)

      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        authDrawerOpen: false,
        pendingEmail: null,
        successMessage: data.message,
        error: null,
      })

      return { success: true, message: data.message }
    } catch (error) {
      const errorMessage = getApiErrorMessage(error, "OTP verification failed")
      set({ isLoading: false, error: errorMessage })
      return { success: false, error: errorMessage }
    }
  },

  logout: () => {
    clearAuthStorage()
    set({
      user: null,
      isAuthenticated: false,
      error: null,
      successMessage: null,
      pendingEmail: null,
      authView: "login",
    })
  },

  hydrate: async () => {
    const token = getAuthToken()
    const storedUser = getStoredUser<PublicUser>()
    const pendingEmail = getPendingEmail()

    if (!token) {
      set({
        user: null,
        isAuthenticated: false,
        isBootstrapping: false,
        pendingEmail,
        authView: pendingEmail ? "verify-otp" : "login",
      })
      return
    }

    if (storedUser) {
      set({
        user: storedUser,
        isAuthenticated: true,
      })
    }

    try {
      const { data } = await api.auth.profile()
      setStoredUser(data.user)
      clearPendingEmail()
      set({
        user: data.user,
        isAuthenticated: true,
        isBootstrapping: false,
        pendingEmail: null,
      })
    } catch {
      clearAuthStorage()
      set({
        user: null,
        isAuthenticated: false,
        isBootstrapping: false,
        pendingEmail: null,
      })
    }
  },

  init: () => {
    void get().hydrate()

    const onUnauthorized = () => {
      get().logout()
    }

    window.addEventListener("unauthorized", onUnauthorized)
    return () => window.removeEventListener("unauthorized", onUnauthorized)
  },
}))
