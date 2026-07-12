import { escapeHtml, renderLayout } from "./shared.js";
import type { EmailContent, EmailTemplateData } from "./types.js";

export function renderGenerationCompleted(
  data: EmailTemplateData["generation-completed"],
): EmailContent {
  return {
    subject: "Your thumbnail is ready",
    text: [
      `Hi ${data.name},`,
      "",
      "Your thumbnail generation completed successfully.",
      "Open Thumbcraft to view and download your results.",
    ].join("\n"),
    html: renderLayout(`
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>Your thumbnail generation completed successfully.</p>
      <p>Open Thumbcraft to view and download your results.</p>
    `),
  };
}
