import type { ThumbnailPreferences } from "@/types/generation"

export type PreferenceFieldType =
  | "single-select"
  | "boolean"
  | "text"
  | "dynamic-select"

export type PreferenceFieldDefinition = {
  id: keyof ThumbnailPreferences
  type: PreferenceFieldType
  title: string
  description: string
  options?: string[]
  placeholder?: string
  dependsOn?: { field: keyof ThumbnailPreferences; value: string }
}

/**
 * Mirrors generation-worker preference-catalog (prompt-embedded fields only).
 * Model / aspect / resolution stay on the prompt composer.
 */
export const PREFERENCE_CATALOG: PreferenceFieldDefinition[] = [
  {
    id: "niche",
    type: "single-select",
    title: "What type of content is this?",
    description:
      "Helps the AI understand the target audience and thumbnail style.",
    options: [
      "Technology",
      "Programming",
      "AI",
      "Gaming",
      "Finance",
      "Business",
      "Education",
      "Fitness",
      "Podcast",
      "Travel",
      "Food",
      "Automotive",
      "Sports",
      "Movies",
      "News",
      "Science",
      "Music",
      "Other",
    ],
  },
  {
    id: "mood",
    type: "single-select",
    title: "What feeling should the thumbnail create?",
    description: "Defines the emotional tone of the generated thumbnail.",
    options: [
      "Exciting",
      "Curious",
      "Shocking",
      "Urgent",
      "Professional",
      "Friendly",
      "Luxury",
      "Minimal",
      "Dark",
      "Energetic",
      "Funny",
      "Mysterious",
      "Inspirational",
    ],
  },
  {
    id: "visualStyle",
    type: "single-select",
    title: "Choose a visual style",
    description: "Determines the overall artistic direction of the thumbnail.",
    options: [
      "Photorealistic",
      "Cinematic",
      "Modern",
      "Minimal",
      "3D Render",
      "Illustration",
      "Anime",
      "Comic",
      "Cyberpunk",
      "Retro",
      "Neon",
      "Documentary",
      "MrBeast Style",
    ],
  },
  {
    id: "primaryColor",
    type: "single-select",
    title: "Choose a dominant color",
    description: "Sets the primary accent color for the thumbnail.",
    options: [
      "Auto",
      "Blue",
      "Red",
      "Yellow",
      "Orange",
      "Green",
      "Purple",
      "Pink",
      "Black",
      "White",
      "Gold",
    ],
  },
  {
    id: "backgroundStyle",
    type: "single-select",
    title: "Choose a background style",
    description: "Controls the appearance of the background.",
    options: [
      "Auto",
      "Blurred",
      "Solid Color",
      "Gradient",
      "Studio",
      "Gaming Room",
      "Office",
      "City",
      "Nature",
      "Abstract",
      "Space",
      "Cyberpunk",
    ],
  },
  {
    id: "lighting",
    type: "single-select",
    title: "Choose a lighting style",
    description: "Determines the lighting and atmosphere.",
    options: [
      "Natural",
      "Studio",
      "Soft",
      "High Contrast",
      "Dramatic",
      "Golden Hour",
      "Neon",
      "Dark",
      "Volumetric",
    ],
  },
  {
    id: "composition",
    type: "single-select",
    title: "Choose a composition",
    description: "Controls how the subject is positioned in the image.",
    options: [
      "Centered",
      "Rule of Thirds",
      "Close-up",
      "Extreme Close-up",
      "Split Layout",
      "Left Focus",
      "Right Focus",
      "Wide Shot",
    ],
  },
  {
    id: "faceEmphasis",
    type: "single-select",
    title: "How prominent should the face be?",
    description:
      "Useful for thumbnails where facial expressions drive engagement.",
    options: ["None", "Subtle", "Medium", "Strong", "Extreme"],
  },
  {
    id: "includeText",
    type: "boolean",
    title: "Should the thumbnail include text?",
    description:
      "Determines whether the generated thumbnail should contain text.",
    options: ["Yes", "No"],
  },
  {
    id: "textStyle",
    type: "single-select",
    title: "Choose a text style",
    description: "Applied only when text is enabled.",
    dependsOn: { field: "includeText", value: "Yes" },
    options: [
      "Bold",
      "Modern",
      "Minimal",
      "Gaming",
      "Luxury",
      "Outline",
      "Gradient",
      "Glow",
      "3D",
    ],
  },
  {
    id: "textContent",
    type: "text",
    title: "What text should appear?",
    description: "Optional overlay text to include in the thumbnail.",
    placeholder: "React in 15 Minutes",
    dependsOn: { field: "includeText", value: "Yes" },
  },
]

export function getVisiblePreferenceFields(
  preferences: ThumbnailPreferences,
): PreferenceFieldDefinition[] {
  return PREFERENCE_CATALOG.filter((field) => {
    if (!field.dependsOn) return true
    const current = preferences[field.dependsOn.field]
    const normalized =
      typeof current === "boolean" ? (current ? "Yes" : "No") : current
    return normalized === field.dependsOn.value
  })
}
