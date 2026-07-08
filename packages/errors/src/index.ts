export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INSUFFICIENT_FUNDS"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
