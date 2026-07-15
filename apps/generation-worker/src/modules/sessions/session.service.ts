import { AppError } from "@platform/errors";
import type {
  PrismaClient,
  SessionStatus,
} from "../../generated/prisma/client.js";

export interface CreateSessionInput {
  title?: string | null;
  category?: string | null;
}

export interface UpdateSessionInput {
  title?: string | null;
  category?: string | null;
  pinned?: boolean;
  status?: SessionStatus;
}

export interface ListSessionsOptions {
  status?: SessionStatus;
  pinned?: boolean;
  limit?: number;
  offset?: number;
}

/** Applied when client omits title/category (silent bootstrap / new chat). */
export const DEFAULT_SESSION_TITLE = "New session";
export const DEFAULT_SESSION_CATEGORY = "default";

function resolveTitle(value?: string | null): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : DEFAULT_SESSION_TITLE;
}

function resolveCategory(value?: string | null): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : DEFAULT_SESSION_CATEGORY;
}

const sessionWithCount = {
  _count: { select: { messages: true } },
} as const;

export type SessionWithCount = Awaited<
  ReturnType<typeof findSessionByIdForUser>
>;

export function toPublicSession(session: {
  id: string;
  userId: string;
  title: string | null;
  category: string | null;
  pinned: boolean;
  latestInteractionId: string | null;
  latestMessageId: string | null;
  latestAssistantMessageId: string | null;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: { messages: number };
}) {
  return {
    id: session.id,
    userId: session.userId,
    title: session.title,
    category: session.category,
    pinned: session.pinned,
    latestInteractionId: session.latestInteractionId,
    latestMessageId: session.latestMessageId,
    latestAssistantMessageId: session.latestAssistantMessageId,
    status: session.status,
    messageCount: session._count?.messages ?? 0,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

/**
 * Active session with zero messages — used as the silent "default" session.
 */
export async function findEmptyActiveSessions(
  prisma: PrismaClient,
  userId: string,
) {
  return prisma.generationSession.findMany({
    where: {
      userId,
      status: "active",
      messages: { none: {} },
    },
    orderBy: { createdAt: "asc" },
    include: sessionWithCount,
  });
}

/**
 * Create a session, or reuse (and collapse) an existing empty active session.
 * Frontend silent bootstrap should call this — never leaves multiple dead empties.
 * Title/category are optional; defaults are "New session" / "default".
 */
export async function ensureSession(
  prisma: PrismaClient,
  userId: string,
  input: CreateSessionInput = {},
): Promise<{ session: NonNullable<SessionWithCount>; reused: boolean }> {
  const empties = await findEmptyActiveSessions(prisma, userId);

  if (empties.length > 0) {
    const [keep, ...extras] = empties;

    if (extras.length > 0) {
      await prisma.generationSession.deleteMany({
        where: { id: { in: extras.map((s) => s.id) }, userId },
      });
    }

    const nextTitle =
      input.title !== undefined
        ? resolveTitle(input.title)
        : resolveTitle(keep.title);
    const nextCategory =
      input.category !== undefined
        ? resolveCategory(input.category)
        : resolveCategory(keep.category);

    const needsUpdate =
      keep.title !== nextTitle || keep.category !== nextCategory;

    const session = needsUpdate
      ? await prisma.generationSession.update({
          where: { id: keep.id },
          data: { title: nextTitle, category: nextCategory },
          include: sessionWithCount,
        })
      : keep;

    return { session, reused: true };
  }

  const session = await prisma.generationSession.create({
    data: {
      userId,
      title: resolveTitle(input.title),
      category: resolveCategory(input.category),
    },
    include: sessionWithCount,
  });

  return { session, reused: false };
}

export async function listSessionsForUser(
  prisma: PrismaClient,
  userId: string,
  options: ListSessionsOptions = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const where = {
    userId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.pinned !== undefined ? { pinned: options.pinned } : {}),
  };

  const [sessions, total] = await Promise.all([
    prisma.generationSession.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: limit,
      skip: offset,
      include: sessionWithCount,
    }),
    prisma.generationSession.count({ where }),
  ]);

  return { sessions, total, limit, offset };
}

export async function findSessionByIdForUser(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
) {
  return prisma.generationSession.findFirst({
    where: { id: sessionId, userId },
    include: sessionWithCount,
  });
}

export async function updateSessionForUser(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  input: UpdateSessionInput,
) {
  const existing = await findSessionByIdForUser(prisma, userId, sessionId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }

  return prisma.generationSession.update({
    where: { id: sessionId },
    data: {
      ...(input.title !== undefined ? { title: resolveTitle(input.title) } : {}),
      ...(input.category !== undefined
        ? { category: resolveCategory(input.category) }
        : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: sessionWithCount,
  });
}

export async function deleteSessionForUser(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
) {
  const existing = await findSessionByIdForUser(prisma, userId, sessionId);
  if (!existing) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }

  await prisma.generationSession.delete({ where: { id: sessionId } });
  return existing;
}
