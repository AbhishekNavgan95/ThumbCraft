import { escapeHtml, renderLayout } from "./shared.js";
import type { EmailContent, EmailTemplateData } from "./types.js";

export function renderGenerationFailed(
  data: EmailTemplateData["generation-failed"],
): EmailContent {
  return {
    subject: "Thumbnail generation failed",
    text: [
      `Hi ${data.name},`,
      "",
      "We couldn't generate your thumbnail.",
      `Reason: ${data.error}`,
      "",
      "Please try again, or adjust your prompt and settings.",
    ].join("\n"),
    html: renderLayout(`
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>We couldn't generate your thumbnail.</p>
      <p><strong>Reason:</strong> ${escapeHtml(data.error)}</p>
      <p>Please try again, or adjust your prompt and settings.</p>
    `),
  };
}
