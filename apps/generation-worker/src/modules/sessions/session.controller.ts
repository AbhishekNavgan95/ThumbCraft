import { AppError } from "@platform/errors";
import type { PrismaClient, SessionStatus } from "../../generated/prisma/client.js";
import {
  deleteSessionForUser,
  ensureSession,
  findSessionByIdForUser,
  listSessionsForUser,
  toPublicSession,
  updateSessionForUser,
  type CreateSessionInput,
  type UpdateSessionInput,
} from "./session.service.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SESSION_STATUSES = new Set<SessionStatus>(["active", "archived"]);

function assertUuid(id: string, field = "sessionId"): void {
  if (!UUID_RE.test(id)) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a valid UUID`, 422);
  }
}

function assertUserId(userId: string): void {
  assertUuid(userId, "userId");
}

function parseOptionalNullableString(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be a string or null`,
      422,
    );
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCreateInput(body: Record<string, unknown>): CreateSessionInput {
  return {
    title: parseOptionalNullableString(body.title, "title"),
    category: parseOptionalNullableString(body.category, "category"),
  };
}

function parseUpdateInput(body: Record<string, unknown>): UpdateSessionInput {
  const input: UpdateSessionInput = {
    title: parseOptionalNullableString(body.title, "title"),
    category: parseOptionalNullableString(body.category, "category"),
  };

  if (body.pinned !== undefined) {
    if (typeof body.pinned !== "boolean") {
      throw new AppError("VALIDATION_ERROR", "pinned must be a boolean", 422);
    }
    input.pinned = body.pinned;
  }

  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !SESSION_STATUSES.has(body.status as SessionStatus)
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        'status must be "active" or "archived"',
        422,
      );
    }
    input.status = body.status as SessionStatus;
  }

  if (
    input.title === undefined &&
    input.category === undefined &&
    input.pinned === undefined &&
    input.status === undefined
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Provide at least one field to update (title, category, pinned, status)",
      422,
    );
  }

  return input;
}

function parseListQuery(query: Record<string, unknown>) {
  let status: SessionStatus | undefined;
  if (query.status !== undefined) {
    if (
      typeof query.status !== "string" ||
      !SESSION_STATUSES.has(query.status as SessionStatus)
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        'status must be "active" or "archived"',
        422,
      );
    }
    status = query.status as SessionStatus;
  }

  let pinned: boolean | undefined;
  if (query.pinned !== undefined) {
    if (query.pinned === true || query.pinned === "true") {
      pinned = true;
    } else if (query.pinned === false || query.pinned === "false") {
      pinned = false;
    } else {
      throw new AppError(
        "VALIDATION_ERROR",
        'pinned must be a boolean (true/false)',
        422,
      );
    }
  }

  let limit: number | undefined;
  if (query.limit !== undefined) {
    const raw =
      typeof query.limit === "string" ? Number(query.limit) : query.limit;
    if (!Number.isInteger(raw) || (raw as number) < 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "limit must be a positive integer",
        422,
      );
    }
    limit = raw as number;
  }

  let offset: number | undefined;
  if (query.offset !== undefined) {
    const raw =
      typeof query.offset === "string" ? Number(query.offset) : query.offset;
    if (!Number.isInteger(raw) || (raw as number) < 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "offset must be a non-negative integer",
        422,
      );
    }
    offset = raw as number;
  }

  return { status, pinned, limit, offset };
}

/**
 * POST /api/sessions — ensure default session (reuse empty active with 0 messages).
 * Intended for silent frontend bootstrap and explicit "new chat" (deduped).
 */
export async function createSessionController(
  prisma: PrismaClient,
  userId: string,
  body: Record<string, unknown>,
) {
  assertUserId(userId);
  const input = parseCreateInput(body);
  const { session, reused } = await ensureSession(prisma, userId, input);
  return {
    session: toPublicSession(session),
    reused,
  };
}

export async function listSessionsController(
  prisma: PrismaClient,
  userId: string,
  query: Record<string, unknown>,
) {
  assertUserId(userId);
  const options = parseListQuery(query);
  const result = await listSessionsForUser(prisma, userId, options);
  return {
    sessions: result.sessions.map(toPublicSession),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    hasMore: result.offset + result.sessions.length < result.total,
  };
}

export async function getSessionController(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
) {
  assertUserId(userId);
  assertUuid(sessionId);
  const session = await findSessionByIdForUser(prisma, userId, sessionId);
  if (!session) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }
  return { session: toPublicSession(session) };
}

export async function patchSessionController(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  body: Record<string, unknown>,
) {
  assertUserId(userId);
  assertUuid(sessionId);
  const input = parseUpdateInput(body);
  const session = await updateSessionForUser(prisma, userId, sessionId, input);
  return { session: toPublicSession(session) };
}

export async function deleteSessionController(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
) {
  assertUserId(userId);
  assertUuid(sessionId);
  const session = await deleteSessionForUser(prisma, userId, sessionId);
  return { session: toPublicSession(session) };
}
