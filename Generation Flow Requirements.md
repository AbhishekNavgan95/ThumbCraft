# Generation Flow Requirements

Requirements for how a thumbnail generation request becomes an LLM call.

Related: [`developmentplan.md`](./developmentplan.md) (sessions / messages), [`plan.md`](./plan.md) (platform).

---

## Prompt types glossary

There are **user-facing inputs**, a **fixed product template**, and **one string that actually goes to the image LLM**. Do not mix them.

```
What user types          → originalPrompt / enhancedPrompt
What product always says → baseSystemPrompt
What wizard answers      → preferences (become text clauses)
What LLM receives        → providerInput
What LLM uses as settings → model + aspect + resolution (not prompt text)
```

| Name | What it is | Stored as | Sent to image LLM? |
|------|------------|-----------|--------------------|
| **`originalPrompt`** | Exactly what the user typed | `GenerationMessage.originalPrompt` | Indirectly via `userText` → `providerInput` |
| **`enhancedPrompt`** | Enhance-feature rewrite of the typed text only | `GenerationMessage.enhancedPrompt` | Indirectly if `usedEnhancedPrompt` |
| **`userText`** | Active wording for the turn = enhanced \|\| original | Derived (not a column) | Yes — inside `providerInput` |
| **`baseSystemPrompt`** | Fixed product instructions (thumbnail rules, priority, safe margins) | Code (`generation-base.ts`) | Only on **first** image turn (inside `providerInput`) |
| **Preferences block** | Wizard answers turned into supporting style clauses | Source: `preferences` JSONB | Only on **first** image turn (inside `providerInput`) |
| **`providerInput`** | Exact string passed as LLM `input` for this turn | `GenerationMessage.providerInput` | **Yes — this is the LLM input** |
| **Top-level preferences** | Model, aspect ratio, resolution | `modelId`, `requiredAspectRatio`, `requiredResolution` | No — applied as call args (`model` + `response_format`) |

### Rules

1. **`originalPrompt` / `enhancedPrompt` never hold the assembled string.** They are only the user’s typed text (and optional enhance of that text). The enhance feature must never write base+preferences into `enhancedPrompt`.
2. **`providerInput` is the only place that stores what the image model actually received.** Set when the generation job is dispatched.
3. **First image turn vs later turns:**

```
userText = usedEnhancedPrompt && enhancedPrompt ? enhancedPrompt : originalPrompt

if first image turn in session (no latestInteractionId yet):
  providerInput = baseSystemPrompt + userText + preferencesBlock
else:
  providerInput = userText   // refine / edit only
```

4. Later turns rely on Gemini `previous_interaction_id` (or prior image + short prompt for OpenAI). Do **not** re-embed base system prompt + preferences on every refine.

### Example

**User types:** `React tutorial thumbnail`  
**Enhance (optional):** richer wording → `enhancedPrompt`  
**Prefs:** niche Programming, accent Blue, …  
**Model:** Flash, `16:9`, `2K`

**Turn 1 `providerInput`:**
```
[base system: thumbnail rules + safe margins…]
Main objective: <userText>
Supporting style parameters:
- niche…
- accent color Blue only…
```

**Turn 2 user types:** `Increase face size`  
**Turn 2 `providerInput`:**
```
Increase face size
```
(+ `previous_interaction_id`, plus model / aspect / resolution on the call)

---

## Core requirement

The user always sends **three kinds of parameters**:

| # | Parameter | What it is | How it is used |
|---|-----------|------------|----------------|
| 1 | **Primary prompt** | Free-text description from the user | **Main creative context.** Highest priority. Defines subject, scene, and intent. |
| 2 | **Preferences** | Wizard answers (niche, mood, style, color, …) | Supporting style parameters. Combined with the base system prompt and primary prompt into the **final generation prompt** passed as LLM `input`. |
| 3 | **Top-level preferences** | Model, aspect ratio, resolution | **Not** part of the prompt text. Applied directly on the LLM API call. |

```
                    ┌─────────────────────┐
                    │  Base system prompt │  (fixed product instructions)
                    └──────────┬──────────┘
                               │
     ┌─────────────────────────┼─────────────────────────┐
     │                         │                         │
     ▼                         ▼                         ▼
 Primary prompt          Preferences              Top-level preferences
 (main context)     (supporting modifiers)      (model / aspect / resolution)
     │                         │                         │
     └────────────┬────────────┘                         │
                  ▼                                      ▼
     Final generation prompt                    LLM call arguments
     (assembled string → input)                 model + response_format
                  │                                      │
                  └──────────────────┬───────────────────┘
                                     ▼
                              Provider (Gemini / OpenAI)
```

---

## 1. Primary prompt (main context)

- Field: `originalPrompt` (user’s own text).
- This is the **main context** for what the thumbnail should depict.
- Preferences must **support** this prompt, never override or wash it out.
- Optional enhance expands language around this prompt but must keep it dominant.

---

## 2. Preferences (embedded into the final prompt)

Stored on `GenerationMessage.preferences` (JSONB). Never include model / aspect / resolution here.

| id | type | Role |
|----|------|------|
| `niche` | single-select | Content type / audience |
| `mood` | single-select | Emotional tone |
| `visualStyle` | single-select | Artistic direction |
| `primaryColor` | single-select | **Accent color only** — accents on highlights, UI, text, borders, props. Not a full-frame color wash. `Auto` → omit |
| `backgroundStyle` | single-select | Background treatment. `Auto` → omit |
| `lighting` | single-select | Lighting / atmosphere |
| `composition` | single-select | Subject framing |
| `faceEmphasis` | single-select | Face prominence. `None` → omit |
| `includeText` | boolean | Whether overlay text is required |
| `textStyle` | single-select | Text look (only if text enabled) |
| `textContent` | text | Exact overlay copy (only if text enabled) |

### Preference intensity

Preferences are **supporting parameters**:

- Apply them so the image still reads as the user’s subject first.
- Example: `primaryColor = Red` → red accents on elements, **not** an entirely red-tinted image.
- Mood / style / lighting tweak atmosphere; they must not replace the main subject.

---

## 3. Top-level preferences (direct LLM call args)

Stored as first-class columns — **not** inside `preferences` JSON, **not** inside the prompt text.

| User field | Stored as | LLM call |
|------------|-----------|----------|
| `model` | `modelId` → resolve `providerModelId` | `model: providerModelId` |
| `aspectRatio` | `requiredAspectRatio` | `response_format.aspect_ratio` |
| `resolution` | `requiredResolution` | `response_format.image_size` (Gemini) / provider equivalent |

UI: pick **model** first; aspect / resolution options come from that model’s capability lists.

Example Gemini call:

```ts
client.interactions.create({
  model: selectedModel.providerModelId,
  input: finalGenerationPrompt, // base + primary + preferences
  previous_interaction_id: session.latestInteractionId, // edits only
  response_format: {
    type: "image",
    mime_type: "image/jpeg",
    aspect_ratio: requiredAspectRatio,
    image_size: requiredResolution,
  },
});
```

---

## Final generation prompt assembly

### Formula

```
finalGenerationPrompt =
  baseSystemPrompt
  + primaryPrompt   (main context)
  + preferencesBlock  (structured supporting parameters)
```

Optionally run **enhance** on the user primary prompt (or on the assembled brief) before / during assembly; persist `originalPrompt` and `enhancedPrompt` separately. The string sent to the image model is always the **full** final generation prompt (base + main context + preferences).

### Base system prompt (required content)

Fixed product instructions. Version and store under `src/prompts/` (same registry pattern as `prompt_enhance`).

Must include:

1. **What we are doing** — generating a high-performing content thumbnail: clear subject, strong hierarchy, readable at small sizes, eye-catching.
2. **Priority rule** — the user’s primary prompt is the main context; preferences are supporting modifiers only and must not dominate the overall look.
3. **Safe margin / edge rule** (mandatory):

   > Do not place text on the borders of the image. Always keep a slight space between the border of the image and any text or character in the image.

4. Other hard quality rules as needed (legibility, mobile-friendly crop, etc.).

### Preferences block format

Structured, scannable clauses under a supporting-parameters heading. Phrasing must encode non-dominance (especially for color).

Pseudo-structure:

```
[BASE SYSTEM PROMPT]

Main objective (highest priority):
<primary prompt or enhanced primary prompt>

Supporting style parameters (apply lightly; do not override the main objective):
- Content niche: …
- Emotional mood: …
- Visual style: …
- Accent color: use <color> on accents only — do NOT tint the entire image that color
- Background: … (keep subject clear)
- Lighting: …
- Composition: …
- Face emphasis: … (only if a face belongs in the main objective)
- Text: … / Do not include overlay text
```

### Assembler contract

```ts
function buildFinalGenerationPrompt(args: {
  primaryPrompt: string;
  preferences: Preferences;
}): string;
```

- Omit `Auto` / `None` clauses.
- If `includeText` is false → strip `textStyle` / `textContent` and state no overlay text.
- Never inject model, aspect ratio, or resolution into this string.

---

## Request payload

```ts
{
  sessionId?: string;
  originalPrompt: string;          // (1) primary prompt — main context
  enhancePrompt?: boolean;
  preferences: {                   // (2) supporting preferences
    niche: string;
    mood: string;
    visualStyle: string;
    primaryColor: string;
    backgroundStyle: string;
    lighting: string;
    composition: string;
    faceEmphasis: string;
    includeText: "Yes" | "No" | boolean;
    textStyle?: string;
    textContent?: string;
  };
  modelId: string;                 // (3) top-level
  requiredAspectRatio: string;     // (3) top-level
  requiredResolution: string;      // (3) top-level
  referenceImageUrls?: string[];
  referenceTemplateIds?: string[];
}
```

### Validation

1. `originalPrompt` required (non-empty).
2. Preference selects ∈ catalog; `Auto` / dependent fields respected.
3. `modelId` → visible `generation_models` row.
4. Aspect / resolution ∈ that model’s supported lists.
5. Top-level fields never stored inside `preferences` JSON.

---

## Persistence (message)

```
GenerationMessage (role=user)
  originalPrompt              ← what the user typed (never overwritten by assembly)
  enhancedPrompt?             ← enhance-feature rewrite of typed text only
  usedEnhancedPrompt          ← which typed text is active (userText)
  providerInput?              ← exact string sent to the image LLM for this turn
  preferences                 ← (2) supporting snapshot
  modelId                     ← (3)
  requiredAspectRatio         ← (3)
  requiredResolution          ← (3)
  referenceImageUrls / referenceTemplateIds
```

### How `providerInput` is built

```
userText = usedEnhancedPrompt && enhancedPrompt ? enhancedPrompt : originalPrompt

if first image turn in session (no latestInteractionId yet):
  providerInput = baseSystemPrompt + userText + preferencesBlock
else:
  providerInput = userText   // refine / edit — do not re-embed base + preferences
```

Persist `providerInput` when the generation job is dispatched. Do **not** store the combined string in `originalPrompt` or `enhancedPrompt`.

---

## Generate flow (requirements)

```
1. Client collects (1) primary prompt, (2) preferences, (3) model + aspect + resolution
2. POST generate via gateway → worker
3. Validate all three parameter kinds
4. Ensure session; create user message (store snapshot)
5. Optional: enhance primary prompt → persist enhancedPrompt
6. Create assistant message + generation job; reserve wallet
7. Consumer:
     a. resolve userText = enhanced || original
     b. build providerInput
          — turn 1: baseSystemPrompt + userText + preferences
          — later:  userText only
     c. persist providerInput on the user message
     d. adapter.generate({
          model: providerModelId,
          input: providerInput,
          response_format: { aspect_ratio, image_size },
          refs?,
          previousInteractionId?,
        })
     e. upload S3; complete message; update session latest_*
8. Client polls job → image
```

### Refine / edit

- Edit text is stored as that turn’s `originalPrompt` (optionally enhanced).
- `providerInput` for refine turns is **only** the active user text — no base system prompt, no preferences re-embed (Gemini already has context via `previous_interaction_id`).
- Preferences / top-level: inherit previous message unless UI re-sends overrides.
- Gemini: `previous_interaction_id = session.latestInteractionId`.
- Top-level model / aspect / resolution still applied on the call.

---

## Catalog (UI + validation)

Versioned preference catalog shared by web + worker. Dynamic selectors for top-level prefs are UI metadata only; API posts them as `modelId` / `requiredAspectRatio` / `requiredResolution`.

```
src/prompts/
  generation-base.ts           # base system prompt (incl. safe-margin rule)
  build-generation-prompt.ts   # assembler
  preference-catalog.json      # wizard options
  prompt-enhance.ts            # existing
  types.ts
```

---

## Implementation checklist

- [ ] Base generation system prompt (product context + priority rule + **safe margin / no border text** rule)
- [ ] Preference catalog + TypeScript types
- [ ] `buildFinalGenerationPrompt(primaryPrompt, preferences)` + tests (Auto omit, text dependsOn, accent-color phrasing, margin instructions present)
- [ ] Validate generate/refine payloads (all three parameter kinds)
- [ ] Persist user message snapshot (`originalPrompt`, `enhancedPrompt?`, `providerInput`, `preferences`, `modelId`, aspect, resolution)
- [ ] Gemini adapter: `model` + `input` (final prompt) + `response_format`
- [ ] OpenAI adapter: map top-level aspect/resolution to provider params
- [ ] Gateway: pass primary prompt + preferences + top-level fields unchanged
- [ ] Wire into session message + consumer path (see `developmentplan.md`)

---

## Summary

| Input | Role | Destination |
|-------|------|-------------|
| **Primary prompt** | Main context | Inside final generation prompt |
| **Preferences** | Supporting style parameters | Inside final generation prompt (must not dominate) |
| **Base system prompt** | Product + quality + safe-margin rules | Inside final generation prompt |
| **Model / aspect / resolution** | Top-level preferences | Directly on LLM call (`model` + `response_format`) |
