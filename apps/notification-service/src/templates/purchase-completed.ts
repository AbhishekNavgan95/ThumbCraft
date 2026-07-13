import { escapeHtml, renderLayout } from "./shared.js";
import type { EmailContent, EmailTemplateData } from "./types.js";

export function renderPurchaseCompleted(
  data: EmailTemplateData["purchase-completed"],
): EmailContent {
  return {
    subject: "Payment successful — coins added",
    text: [
      `Hi ${data.name},`,
      "",
      "Your payment was successful.",
      `Package: ${data.packageName}`,
      `Coins added: ${data.coins}`,
      `Payment ID: ${data.stripePaymentId}`,
      "",
      "Your wallet balance has been updated. You can start generating thumbnails anytime.",
    ].join("\n"),
    html: renderLayout(`
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>Your payment was successful.</p>
      <p><strong>Package:</strong> ${escapeHtml(data.packageName)}</p>
      <p><strong>Coins added:</strong> ${escapeHtml(String(data.coins))}</p>
      <p><strong>Payment ID:</strong> ${escapeHtml(data.stripePaymentId)}</p>
      <p>Your wallet balance has been updated. You can start generating thumbnails anytime.</p>
    `),
  };
}
