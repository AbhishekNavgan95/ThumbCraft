import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"
import { clearAuthStorage, getAuthToken } from "@/lib/auth-token"
import type {
  LoginResponse,
  ProfileResponse,
  SignupResponse,
  VerifyOtpResponse,
} from "@/types/auth"
import type { CategoriesResponse } from "@/types/gallery"
import type { WalletBalance } from "@/types/wallet"

export type ApiError = {
  message: string
  status: number
  code?: string
  data?: unknown
}

function readSuggestion(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const details = (data as { details?: unknown }).details
  if (!details || typeof details !== "object") return undefined
  const suggestion = (details as { suggestion?: unknown }).suggestion
  return typeof suggestion === "string" && suggestion.length > 0
    ? suggestion
    : undefined
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback

  const message =
    "message" in error && typeof error.message === "string" && error.message.length > 0
      ? error.message
      : fallback

  const data = "data" in error ? error.data : undefined
  const suggestion = readSuggestion(data)
  return suggestion ? `${message}. ${suggestion}` : message
}

export function isApiError(error: unknown): error is ApiError {
  if (error === null || typeof error !== "object") return false
  return (
    "status" in error &&
    typeof (error as ApiError).status === "number" &&
    "message" in error
  )
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  timeout: 120_000,
  headers: {
    "Content-Type": "application/json",
  },
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: unknown) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response,
  (
    error: AxiosError<{
      error?: string
      message?: string
      code?: string
      details?: { suggestion?: string }
    }>,
  ) => {
    if (error.response) {
      const { status, data } = error.response
      const hadToken = Boolean(error.config?.headers?.Authorization)

      // Only treat 401 as session expiry when a token was sent.
      // Auth endpoints (e.g. invalid OTP) can also return 401.
      if (status === 401 && hadToken) {
        clearAuthStorage()
        window.dispatchEvent(new Event("unauthorized"))
      }

      const apiError: ApiError = {
        message: data?.error || data?.message || "An error occurred",
        status,
        code: data?.code,
        data,
      }
      return Promise.reject(apiError)
    }

    if (error.request) {
      if (error.code === "ECONNABORTED") {
        const apiError: ApiError = {
          message: "Request timed out. Please try again.",
          status: 0,
          code: "TIMEOUT",
        }
        return Promise.reject(apiError)
      }

      const apiError: ApiError = {
        message: "Network error. Please check your connection.",
        status: 0,
      }
      return Promise.reject(apiError)
    }

    const message = error.message || "An unexpected error occurred"
    const apiError: ApiError = {
      message,
      status: 0,
      code:
        message.includes("canceled") || message.includes("NS_BINDING_ABORTED")
          ? "CANCELLED"
          : undefined,
    }
    return Promise.reject(apiError)
  },
)

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiClient.post<LoginResponse>("/api/login", credentials),
    signup: (userData: { name: string; email: string; password: string }) =>
      apiClient.post<SignupResponse>("/api/signup", userData),
    verifyOtp: (payload: { email: string; otp: string }) =>
      apiClient.post<VerifyOtpResponse>("/api/verify-otp", payload),
    profile: () => apiClient.get<ProfileResponse>("/api/profile"),
  },
  gallery: {
    listCategories: () =>
      apiClient.get<CategoriesResponse>("/api/template-categories"),
  },
  wallet: {
    getBalance: () => apiClient.get<WalletBalance>("/api/wallet"),
  },
  health: () => apiClient.get("/health"),
}

export default apiClient
