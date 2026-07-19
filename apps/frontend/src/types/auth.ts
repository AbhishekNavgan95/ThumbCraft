export type UserRole = "customer" | "admin"

export type PublicUser = {
  id: string
  email: string
  name: string
  role: UserRole
}

export type LoginResponse = {
  token: string
  user: PublicUser
  message: string
}

export type SignupResponse = {
  message: string
  email: string
}

export type VerifyOtpResponse = {
  token: string
  user: PublicUser
  message: string
}

export type ProfileResponse = {
  user: PublicUser
}

export type AuthView = "login" | "signup" | "verify-otp"
