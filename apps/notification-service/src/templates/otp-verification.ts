import { escapeHtml, renderLayout } from "./shared.js";
import type { EmailContent, EmailTemplateData } from "./types.js";

export function renderOtpVerification(
  data: EmailTemplateData["otp-verification"],
): EmailContent {
  const expiresLabel = new Date(data.expiresAt).toLocaleString();

  return {
    subject: "Your Thumbcraft verification code",
    text: [
      `Hi ${data.name},`,
      "",
      `Your verification code is ${data.otp}.`,
      `This code expires at ${expiresLabel}.`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: renderLayout(`
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>Your verification code is <strong>${escapeHtml(data.otp)}</strong>.</p>
      <p>This code expires at ${escapeHtml(expiresLabel)}.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `),
  };
}
