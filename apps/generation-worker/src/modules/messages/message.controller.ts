import { AppError } from "@platform/errors";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  listMessagesForSession,
  toPublicMessage,
} from "./message.service.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listSessionMessagesController(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
) {
  if (!UUID_RE.test(sessionId)) {
    throw new AppError("VALIDATION_ERROR", "sessionId must be a valid UUID", 422);
  }
  const messages = await listMessagesForSession(prisma, userId, sessionId);
  return { messages: messages.map(toPublicMessage) };
}
