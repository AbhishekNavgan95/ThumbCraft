const AUTH_TOKEN_KEY = "token"
const AUTH_USER_KEY = "user"
const PENDING_EMAIL_KEY = "pendingEmail"

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export function setStoredUser(user: unknown): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function clearStoredUser(): void {
  localStorage.removeItem(AUTH_USER_KEY)
}

export function getPendingEmail(): string | null {
  return localStorage.getItem(PENDING_EMAIL_KEY)
}

export function setPendingEmail(email: string): void {
  localStorage.setItem(PENDING_EMAIL_KEY, email.trim().toLowerCase())
}

export function clearPendingEmail(): void {
  localStorage.removeItem(PENDING_EMAIL_KEY)
}

export function clearAuthStorage(): void {
  clearAuthToken()
  clearStoredUser()
  clearPendingEmail()
}
