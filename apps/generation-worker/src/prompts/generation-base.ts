import type { SystemPromptDefinition } from "./types.js";

export const GENERATION_BASE_SYSTEM: SystemPromptDefinition = {
  key: "generation_base",
  version: 1,
  description:
    "Base instructions for thumbnail image generation: product context, priority, safe margins.",
  content: `You are generating a high-performing content thumbnail for social platforms (YouTube, Instagram, TikTok, and similar).

Goals:
- Clear focal subject, strong visual hierarchy, high contrast
- Eye-catching and readable at small sizes
- Clean composition suitable for a thumbnail crop

Priority rules:
- The user's main objective is the highest priority. It defines the subject, scene, and intent.
- Style preferences are supporting modifiers only. Apply them lightly so they enhance the main objective and do NOT dominate or replace it.
- Example: a primary color must be used as an accent on elements (highlights, UI chrome, text, borders, props) — never as a full-frame color wash or monochrome tint of the entire image.

Safe margin / edge rules (mandatory):
- Do not place text on the borders of the image.
- Always keep a slight space between the border of the image and any text or character in the image.
- Keep important faces, hands, and titles safely inside the frame with a small padding from every edge.

Output:
- Produce a single polished thumbnail image that follows the main objective first, then the supporting style parameters.`,
};
