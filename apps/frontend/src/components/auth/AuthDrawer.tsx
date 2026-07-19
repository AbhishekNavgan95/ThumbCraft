import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  loginSchema,
  signupSchema,
  verifyOtpSchema,
  zodFieldErrors,
  type FieldErrors,
} from "@/lib/auth-schemas"
import { clearPendingEmail } from "@/lib/auth-token"
import { useAuthStore } from "@/stores/auth-store"

export function AuthDrawer() {
  const {
    authDrawerOpen,
    authView,
    isLoading,
    error,
    successMessage,
    pendingEmail,
    closeAuthDrawer,
    setAuthView,
    login,
    signup,
    verifyOtp,
    clearError,
  } = useAuthStore()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (authView === "verify-otp" && pendingEmail) {
      setEmail(pendingEmail)
    }
  }, [authView, pendingEmail])

  const resetFields = () => {
    setName("")
    setEmail("")
    setPassword("")
    setOtp("")
    setFieldErrors({})
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeAuthDrawer()
      resetFields()
    }
  }

  const switchView = (view: "login" | "signup") => {
    clearError()
    setFieldErrors({})
    setAuthView(view)
    setPassword("")
    setOtp("")
  }

  const goBackFromOtp = () => {
    clearPendingEmail()
    useAuthStore.setState({ pendingEmail: null })
    switchView("signup")
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearError()
    setFieldErrors({})

    if (authView === "login") {
      const parsed = loginSchema.safeParse({ email, password })
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error))
        return
      }
      const result = await login(parsed.data.email, parsed.data.password)
      if (result.success && useAuthStore.getState().authView !== "verify-otp") {
        resetFields()
      } else if (result.success) {
        setPassword("")
        setOtp("")
      }
      return
    }

    if (authView === "signup") {
      const parsed = signupSchema.safeParse({ name, email, password })
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error))
        return
      }
      const result = await signup(
        parsed.data.name,
        parsed.data.email,
        parsed.data.password,
      )
      if (result.success) {
        setPassword("")
        setOtp("")
        setFieldErrors({})
      }
      return
    }

    const parsed = verifyOtpSchema.safeParse({
      email: pendingEmail ?? email,
      otp,
    })
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error))
      return
    }

    const result = await verifyOtp(parsed.data.otp)
    if (result.success) resetFields()
  }

  const title =
    authView === "login"
      ? "Sign in"
      : authView === "signup"
        ? "Create account"
        : "Verify email"

  const description =
    authView === "login"
      ? "Sign in to generate thumbnails and manage your sessions."
      : authView === "signup"
        ? "We’ll email you a 6-digit code to verify your account."
        : `Enter the 6-digit code sent to ${pendingEmail ?? "your email"}.`

  return (
    <Sheet open={authDrawerOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4" noValidate>
          {authView === "signup" ? (
            <div className="grid gap-2">
              <Label htmlFor="auth-name">Name</Label>
              <Input
                id="auth-name"
                autoComplete="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => {
                      const next = { ...prev }
                      delete next.name
                      return next
                    })
                  }
                }}
                aria-invalid={Boolean(fieldErrors.name)}
                disabled={isLoading}
              />
              {fieldErrors.name ? (
                <p className="text-sm text-destructive">{fieldErrors.name}</p>
              ) : null}
            </div>
          ) : null}

          {authView !== "verify-otp" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => {
                        const next = { ...prev }
                        delete next.email
                        return next
                      })
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  disabled={isLoading}
                />
                {fieldErrors.email ? (
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={
                    authView === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => {
                        const next = { ...prev }
                        delete next.password
                        return next
                      })
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  disabled={isLoading}
                />
                {fieldErrors.password ? (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="auth-otp">OTP code</Label>
              <Input
                id="auth-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  if (fieldErrors.otp) {
                    setFieldErrors((prev) => {
                      const next = { ...prev }
                      delete next.otp
                      return next
                    })
                  }
                }}
                aria-invalid={Boolean(fieldErrors.otp)}
                disabled={isLoading}
              />
              {fieldErrors.otp ? (
                <p className="text-sm text-destructive">{fieldErrors.otp}</p>
              ) : null}
            </div>
          )}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {successMessage && authView === "verify-otp" ? (
            <p className="text-sm text-muted-foreground">{successMessage}</p>
          ) : null}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading
                ? "Please wait…"
                : authView === "login"
                  ? "Sign in"
                  : authView === "signup"
                    ? "Continue"
                    : "Verify & continue"}
            </Button>

            {authView === "login" ? (
              <p className="text-center text-sm text-muted-foreground">
                No account?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => switchView("signup")}
                  disabled={isLoading}
                >
                  Sign up
                </button>
              </p>
            ) : null}

            {authView === "signup" ? (
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => switchView("login")}
                  disabled={isLoading}
                >
                  Sign in
                </button>
              </p>
            ) : null}

            {authView === "verify-otp" ? (
              <p className="text-center text-sm text-muted-foreground">
                Wrong email?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={goBackFromOtp}
                  disabled={isLoading}
                >
                  Go back
                </button>
              </p>
            ) : null}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
