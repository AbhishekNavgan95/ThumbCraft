import Stripe from "stripe";
import type { WalletServiceConfig } from "../config.js";

export function createStripeClient(config: WalletServiceConfig): Stripe {
  return new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
  });
}
