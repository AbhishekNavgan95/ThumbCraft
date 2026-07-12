import type { Logger } from "@platform/logger";
import type { PlatformEvent, UserRegisteredPayload } from "@platform/messaging-contract";
import type { PrismaClient } from "../generated/prisma/client.js";
import { creditWelcomeBonus } from "../services/wallet.service.js";

export async function handleUserRegistered(
  event: PlatformEvent<UserRegisteredPayload>,
  prisma: PrismaClient,
  welcomeBonusCoins: number,
  logger: Logger,
): Promise<void> {
  await creditWelcomeBonus(prisma, event.userId, welcomeBonusCoins);
  logger.info(
    { userId: event.userId, coins: welcomeBonusCoins, eventId: event.eventId },
    "wallet created with welcome bonus",
  );
}
