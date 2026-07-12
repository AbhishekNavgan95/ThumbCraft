import { escapeHtml, renderLayout } from "./shared.js";
import type { EmailContent, EmailTemplateData } from "./types.js";

export function renderWelcome(data: EmailTemplateData["welcome"]): EmailContent {
  return {
    subject: "Welcome to Thumbcraft",
    text: [
      `Hi ${data.name},`,
      "",
      "Welcome to Thumbcraft! Your account is ready.",
      "You can start generating thumbnails anytime.",
    ].join("\n"),
    html: renderLayout(`
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>Welcome to Thumbcraft! Your account is ready.</p>
      <p>You can start generating thumbnails anytime.</p>
    `),
  };
}
