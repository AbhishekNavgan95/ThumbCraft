# Generation Context Plan

How user preferences become generative context for thumbnail creation.

This plan sits alongside [`generationPlan.md`](./generationPlan.md) (sessions / messages / interactions) and [`plan.md`](./plan.md) (platform architecture). It defines the **preference → prompt / response_format → LLM** contract only.

---

## Goal

Users answer a fixed preference questionnaire. On generate / refine:

1. Most answers are compiled into the **text prompt** (LLM context).
2. **Model**, **aspect ratio**, and **resolution** are **top-level preferences** — they never go into the prompt text. They are applied directly on the provider call:
   - `model` → `interactions.create({ model })`
   - `aspectRatio` / `resolution` → `response_format.{ aspect_ratio, image_size }`

```
User wizard
    │
    ├─ prompt-embedded preferences (niche, mood, style, …)
    │       └──► prompt assembler → input string
    │
    ├─ top-level: model
    │       └──► LLM call `model` argument (selected catalog model → providerModelId)
    │
    ├─ top-level: aspectRatio + resolution
    │       └──► response_format { aspect_ratio, image_size }
    │
    └─ prompt (+ optional enhance, refs, previousInteractionId)
            └──► provider adapter (Gemini / OpenAI)
```
---

## Preference Catalog (v1)

Canonical questionnaire definition. Source of truth for UI, validation, and prompt clauses.

Stored on the user message as:

| Field | Storage |
|--------|---------|
| Prompt-embedded answers | `GenerationMessage.preferences` (JSONB object, keyed by `id`) |
| Model | `GenerationMessage.modelId` |
| Aspect ratio | `GenerationMessage.requiredAspectRatio` |
| Resolution | `GenerationMessage.requiredResolution` |

**Do not** put `model`, `aspectRatio`, or `resolution` inside `preferences` JSON.

### Prompt-embedded preferences

| id | type | Role in prompt |
|----|------|----------------|
| `niche` | single-select | Content type / audience |
| `mood` | single-select | Emotional tone |
| `visualStyle` | single-select | Overall artistic direction (replaces old `thumbnailStyle` + `theme` overlap) |
| `primaryColor` | single-select | Dominant accent (`Auto` → omit from prompt) |
| `backgroundStyle` | single-select | Background treatment (`Auto` → omit) |
| `lighting` | single-select | Lighting / atmosphere |
| `composition` | single-select | Subject framing |
| `faceEmphasis` | single-select | Face prominence (`None` → omit or state “no face focus”) |
| `includeText` | boolean | Whether overlay text is required |
| `textStyle` | single-select | Text look (**only if** `includeText === Yes`) |
| `textContent` | text | Exact overlay copy (**only if** `includeText === Yes`) |

Full option lists live in a shared catalog file (see [Catalog artifact](#catalog-artifact)). UI may hide dependent fields via `dependsOn`.

### Top-level preferences (not in preferences JSON)

These are user-facing preferences in the wizard, but routed as first-class API / provider arguments.

| id | type | Maps to | Validated against |
|----|------|---------|-------------------|
| `model` | dynamic-select | LLM call `model` (= selected row’s `providerModelId`) | Visible rows in `generation_models` (`id` posted as `modelId`) |
| `aspectRatio` | dynamic-select | `response_format.aspect_ratio` | Selected model’s `supportedAspectRatios` |
| `resolution` | dynamic-select | `response_format.image_size` (Gemini) / equivalent OpenAI param | Selected model’s `supportedResolutions` |

**Ordering in UI:** pick `model` first — `aspectRatio` and `resolution` options depend on that model’s capability lists.

Example Gemini call shape:

```ts
client.interactions.create({
  model: selectedModel.providerModelId, // from top-level preference `model` → modelId
  input: assembledPrompt,
  previous_interaction_id: session.latestInteractionId, // edits only
  response_format: {
    type: "image",
    mime_type: "image/jpeg",
    aspect_ratio: requiredAspectRatio, // e.g. "16:9"
    image_size: requiredResolution,    // e.g. "2K"
  },
});
```
---

## Request Payload Shape

What the gateway / sessions API accepts for an initial generate (simplified):

```ts
{
  sessionId?: string;           // omit → create session
  // Top-level preferences (not inside preferences{})
  modelId: string;              // catalog preference id: "model"
  requiredAspectRatio: string;  // catalog preference id: "aspectRatio"
  requiredResolution: string;   // catalog preference id: "resolution"
  originalPrompt: string;
  enhancePrompt?: boolean;
  preferences: {
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
  referenceImageUrls?: string[];
  referenceTemplateIds?: string[];
}
```

Validation rules:

1. `modelId` must refer to a visible `generation_models` row; resolve to `provider` + `providerModelId` for the LLM call.
2. Every prompt-embedded select value ∈ catalog options.
3. If `includeText` is false / `No` → ignore / strip `textStyle` + `textContent`.
4. If `includeText` is true / `Yes` → `textStyle` recommended; `textContent` optional but preferred.
5. `requiredAspectRatio` ∈ selected model’s `supportedAspectRatios`.
6. `requiredResolution` ∈ selected model’s `supportedResolutions`.
7. `Auto` colors/backgrounds are valid answers → **omit** those clauses in the assembler.
---

## Prompt Assembly

### Layers of the final `input` string

```
[1] System / product framing   (thumbnail brief — fixed)
[2] User objective             (originalPrompt or enhancedPrompt)
[3] Preference clauses         (from catalog → natural language)
[4] Text overlay block         (if includeText)
[5] Edit delta                 (refine turns only — freeform edit prompt)
```

Model, aspect ratio, and resolution are **never** mentioned in the prompt. Model is only the call target; aspect / resolution only go in `response_format`.

### Assembler pseudo-code

```ts
function buildGenerationPrompt(args: {
  userPrompt: string;
  preferences: Preferences;
}): string {
  const p = args.preferences;
  const lines: string[] = [];

  lines.push(
    "Create a high-performing content thumbnail. Eye-catching, clear subject, strong hierarchy, readable at small sizes.",
  );
  lines.push(`Main objective: ${args.userPrompt}`);

  lines.push(`Content niche: ${p.niche}.`);
  lines.push(`Emotional mood: ${p.mood}.`);
  lines.push(`Visual style: ${p.visualStyle}.`);

  if (p.primaryColor && p.primaryColor !== "Auto") {
    lines.push(`Dominant accent color: ${p.primaryColor}.`);
  }
  if (p.backgroundStyle && p.backgroundStyle !== "Auto") {
    lines.push(`Background: ${p.backgroundStyle}.`);
  }

  lines.push(`Lighting: ${p.lighting}.`);
  lines.push(`Composition: ${p.composition}.`);

  if (p.faceEmphasis && p.faceEmphasis !== "None") {
    lines.push(`Face emphasis: ${p.faceEmphasis}.`);
  }

  if (isTextEnabled(p.includeText)) {
    lines.push("Include overlay text on the thumbnail.");
    if (p.textStyle) lines.push(`Text style: ${p.textStyle}.`);
    if (p.textContent?.trim()) {
      lines.push(`Exact text to render: "${p.textContent.trim()}".`);
    }
  } else {
    lines.push("Do not include any overlay text.");
  }

  return lines.join(" ");
}
```

### Enhance path

1. Assemble structured prompt from preferences + original prompt (above).
2. If `enhancePrompt` → run existing `prompt_enhance` system prompt on that string.
3. Persist both `originalPrompt` (user’s words) and `enhancedPrompt` (result); `usedEnhancedPrompt = true`.
4. Provider `input` uses enhanced text when flag is set; preferences remain stored as the structured snapshot for audit / regenerate.

Enhance does **not** invent new preference fields — it only expands visual language around the assembled brief.

### Edit / refine path

On later turns, preference snapshot may be:

- **Reuse** last user message preferences (default), or
- **Override** with a new preference payload if the UI re-sends them.

Edit prompts are usually short (“make face larger”). Assembler then:

```
Primary instruction: <edit prompt>
Continue from previous interaction.
Preserve established look unless the edit conflicts.
[optional: restate active preferences briefly if UI changed them]
```

Gemini: `previous_interaction_id = session.latestInteractionId`.  
Top-level prefs on refine: `model` / aspect / resolution may stay the same as the prior user message or be overridden if the UI re-sends them. Changing model mid-session is allowed per message (`modelId` is on the message, not the session).
---

## Mapping to Session / Message Models

Aligns with [`generationPlan.md`](./generationPlan.md) and Prisma schema:

```
GenerationSession
  category?     ← optional: mirror preferences.niche for listing/filters
  latestInteractionId
  …

GenerationMessage (role=user)
  originalPrompt
  enhancedPrompt?
  usedEnhancedPrompt
  preferences          ← JSON: prompt-embedded answers only
  modelId              ← top-level preference `model`
  requiredAspectRatio  ← top-level preference `aspectRatio`
  requiredResolution   ← top-level preference `resolution`
  referenceImageUrls
  referenceTemplateIds

GenerationMessage (role=assistant)
  imageUrl, interactionId, status, …
```

**Rename note vs legacy backend:**  
`category` / `theme` / `thumbnailStyle` → catalog ids `niche` / subsumed into `visualStyle` + `backgroundStyle`. No need to keep legacy keys in the new worker.

---

## Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| **Catalog** (`prompts/preference-catalog.json` or shared package) | Definitions + options + `dependsOn` |
| **Validation** (messages / generate controller) | Prompt values ∈ options; `modelId` visible; aspect/resolution ∈ that model’s lists |
| **Prompt assembler** (`prompts/build-generation-prompt.ts`) | Prompt-embedded preferences → `input` string |
| **Enhance** (existing) | Optional rewrite of assembled prompt |
| **Provider adapter** | `model` = `providerModelId`; `input` + `response_format`; no top-level prefs in prompt text |
| **Sessions / Messages** | Persist snapshot (`modelId` + aspect/resolution + preferences JSON); wire previous interaction on edit |

Suggested files under generation-worker:

```
src/prompts/
  preference-catalog.json      # or .ts exporting the catalog
  build-generation-prompt.ts
  prompt-enhance.ts            # existing
  types.ts                     # Preferences type + catalog types
```

---

## Catalog Artifact

Ship the questionnaire as a versioned asset so web + worker share one list:

```json
{
  "version": 1,
  "preferences": [
    /* prompt-embedded entries … */,
    {
      "id": "model",
      "type": "dynamic-select",
      "title": "Choose an AI model",
      "description": "Options come from visible generation models (title, description, coin cost).",
      "source": "generationModels.visible"
    },
    {
      "id": "aspectRatio",
      "type": "dynamic-select",
      "title": "Choose an aspect ratio",
      "description": "Available options are determined by the selected AI model.",
      "source": "selectedModel.supportedAspectRatios",
      "dependsOn": { "field": "model" }
    },
    {
      "id": "resolution",
      "type": "dynamic-select",
      "title": "Choose an output resolution",
      "description": "Available options are determined by the selected AI model.",
      "source": "selectedModel.supportedResolutions",
      "dependsOn": { "field": "model" }
    }
  ]
}
```

Rules:

- Worker uses catalog for validation + prompt labels.
- Web uses catalog to render the wizard.
- `model` / `aspectRatio` / `resolution` entries with `type: "dynamic-select"` are **UI metadata**; API posts them as top-level fields (`modelId`, `requiredAspectRatio`, `requiredResolution`), never inside `preferences`.
Keep catalog `version` in message `metadata` or alongside preferences when prompts change so old sessions remain interpretable.

---

## End-to-End Generate Flow

```
1. Client loads preference catalog + visible models
2. User picks model (top-level) → aspect/resolution options refresh from that model
3. User fills prompt-embedded preferences + prompt
4. POST generate (gateway → worker)
5. Worker validates modelId + preferences + aspect/resolution vs that model
6. Create/load session; create user message
     (store modelId + requiredAspectRatio + requiredResolution + preferences JSON)
7. Optional: enhance job → write enhancedPrompt
8. Create assistant message + generation job; reserve wallet (cost from selected model)
9. Consumer:
     a. resolve model → providerModelId
     b. assemble prompt (or use enhanced)
     c. adapter.generate({
          model: providerModelId,
          input,
          response_format: { aspect_ratio, image_size },
          refs?,
          previousInteractionId?
        })
     d. upload S3; complete message; update session latest_*
10. Client polls job → images
```
---

## Open Decisions (explicit)

1. **Default model** — first visible by `sortOrder`, or last-used for that user.
2. **Default aspect/resolution** when model supports many — prefer `16:9` + model’s mid size if present, else first listed.
3. **`includeText` wire format** — store boolean in JSONB; accept `Yes`/`No` from UI and normalize on write.
4. **Session.category** — copy from `preferences.niche` on create for history filters, or leave null.
5. **Refine top-level prefs** — inherit previous `modelId` / aspect / resolution unless UI overrides; changing model mid-session is per-message.
6. **OpenAI adapter** — map `image_size` / aspect to that provider’s size + quality params; same assembler; `model` still comes from `providerModelId`.
---

## Out of Scope

- AI Review scoring (see `generationPlan.md`)
- Template gallery browsing (templates only supply `reference_*` URLs/ids)
- Coin pricing (model-driven, unchanged)
- Migrating old Mongo `generationHistory` preference keys

---

## Implementation Checklist

- [ ] Add versioned preference catalog asset (+ TypeScript types), including `model` / aspect / resolution as dynamic-select UI prefs
- [ ] `buildGenerationPrompt(preferences, userPrompt)` unit tests (Auto omit, text dependsOn, face None)
- [ ] Validate generate/refine: `modelId` visible + prompt catalog + aspect/resolution ∈ model lists
- [ ] Persist `modelId` + `requiredAspectRatio` / `requiredResolution` + `preferences` on user messages
- [ ] Gemini adapter: `model: providerModelId` + `response_format.aspect_ratio` / `image_size`
- [ ] OpenAI adapter: same top-level model arg + map aspect/resolution to provider equivalents
- [ ] Web wizard: model first, then dependent aspect/resolution; remaining prompt-embedded prefs
- [ ] Gateway proxies pass top-level `modelId` / aspect / resolution + preferences JSON unchanged
---

## Summary

| User choice | Where it goes |
|-------------|---------------|
| niche, mood, visualStyle, primaryColor, backgroundStyle, lighting, composition, faceEmphasis, includeText, textStyle, textContent | Prompt context via assembler → `input` |
| **model** (top-level) | `modelId` → LLM call `model: providerModelId` |
| **aspectRatio**, **resolution** (top-level) | Message columns → provider `response_format` |
| original prompt / enhance | User objective layer; enhance optional |
