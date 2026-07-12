export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderLayout(bodyHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      ${bodyHtml}
      <p style="margin-top: 24px; color: #666; font-size: 12px;">
        Thumbcraft
      </p>
    </div>
  `.trim();
}
