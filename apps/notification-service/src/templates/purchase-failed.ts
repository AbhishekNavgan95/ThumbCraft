import { escapeHtml, renderLayout } from "./shared.js";
import type { EmailContent, EmailTemplateData } from "./types.js";

export function renderPurchaseFailed(
  data: EmailTemplateData["purchase-failed"],
): EmailContent {
  return {
    subject: "Payment unsuccessful",
    text: [
      `Hi ${data.name},`,
      "",
      "We couldn't complete your coin purchase.",
      `Package: ${data.packageName}`,
      `Coins: ${data.coins}`,
      `Reason: ${data.reason}`,
      "",
      "No coins were added to your wallet. You can try again from Thumbcraft anytime.",
    ].join("\n"),
    html: renderLayout(`
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>We couldn't complete your coin purchase.</p>
      <p><strong>Package:</strong> ${escapeHtml(data.packageName)}</p>
      <p><strong>Coins:</strong> ${escapeHtml(String(data.coins))}</p>
      <p><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>
      <p>No coins were added to your wallet. You can try again from Thumbcraft anytime.</p>
    `),
  };
}
