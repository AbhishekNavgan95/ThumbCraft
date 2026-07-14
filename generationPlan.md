# Session & Interaction Architecture

The Generation Worker treats every image generation workflow as a **persistent chat session** rather than a collection of isolated generation requests.

This closely mirrors how modern conversational AI systems operate while allowing users to iteratively refine generated images without losing context.

---

# Why Sessions?

Traditional image generation APIs are stateless.

```
Generate Image

↓

Image Returned

↓

Request Ends
```

Any subsequent edit requires rebuilding the entire context manually.

Instead, the Generation Worker models image generation as an ongoing conversation.

```
Session

↓

Generate

↓

Edit

↓

Edit

↓

Edit
```

Every generation or edit becomes another message inside the same session.

This provides:

- Complete generation history
- Persistent editing context
- Better UX
- Easy auditing
- Future branching/versioning support
- Provider abstraction

---

# Session Structure

```
Generation Session

├── Session Metadata
│
├── Message 1
│      ├── Prompt
│      ├── Images
│      └── Interaction ID
│
├── Message 2
│      ├── Prompt
│      ├── Images
│      └── Interaction ID
│
├── Message 3
│      ├── Prompt
│      ├── Images
│      └── Interaction ID
│
└── Latest State
```

The session stores only the latest active state while every message preserves historical context.

---

# Session Model

```ts
GenerationSession {

    id

    userId

    title

    category

    provider

    model

    latestInteractionId

    latestMessageId

    latestImageId

    status

    createdAt

    updatedAt

}
```

The session acts as the entry point for the entire generation workflow.

---

# Message Model

Each generation or edit creates a new message.

```ts
GenerationMessage {

    id

    sessionId

    role

    originalPrompt

    enhancedPrompt

    generatedImages

    referenceImages

    preferences

    provider

    model

    interactionId

    metadata

    createdAt

}
```

Messages are immutable once created.

Each message represents a complete snapshot of a generation step.

---

# Interaction ID Strategy

Gemini returns a new `interactionId` after every successful generation.

```
Generate

↓

interactionId = A
```

User edits

```
previousInteractionId = A

↓

interactionId = B
```

User edits again

```
previousInteractionId = B

↓

interactionId = C
```

Rather than storing only the latest interaction ID, every message stores the interaction ID returned for that generation.

```
Message 1

interactionId = A

↓

Message 2

interactionId = B

↓

Message 3

interactionId = C
```

The Generation Session additionally stores

```
latestInteractionId = C
```

This allows the service to continue editing from the latest state while preserving the entire interaction history.

---

# Why Store Every Interaction ID?

Although only the latest interaction ID is required for continuing the conversation, storing every interaction ID provides several advantages.

- Complete audit trail
- Easier debugging
- Future support for branching edits
- Restore generation from any point
- Analytics
- Better provider abstraction

Storage cost is negligible compared to image assets.

---

# Generation Request Pattern

### Initial Generation

```
Create Session

↓

Generate Prompt

↓

Gemini Generate

↓

Receive

Image

Interaction ID

↓

Upload Image to S3

↓

Persist Message

↓

Update Session
```

---

### Editing Request

```
Load Session

↓

Get latestInteractionId

↓

Build Prompt

↓

Gemini Edit

previousInteractionId = latestInteractionId

↓

Receive

Updated Image

New Interaction ID

↓

Upload Image to S3

↓

Create New Message

↓

Update Session
```

Each edit becomes another immutable message.

---

# Session State Update

Every successful generation updates the session.

```
Session

latestInteractionId

↓

A

↓

B

↓

C

↓

D
```

The previous interaction IDs remain attached to their respective messages.

---

# Provider Abstraction

Internally, the Generation Worker hides provider-specific state management.

## Gemini

```
Uses

previousInteractionId
```

## OpenAI

```
Uses

Latest Image

+

Prompt

+

Reference Images
```

The rest of the application only interacts with Generation Sessions.

Provider-specific logic remains isolated inside provider adapters.

---

# Example Timeline

```
Session

────────────────────────────────────

Message 1

Prompt:
React Tutorial

Interaction:
A

Image:
thumb_v1.png

────────────────────────────────────

Message 2

Prompt:
Increase face size

Interaction:
B

Image:
thumb_v2.png

────────────────────────────────────

Message 3

Prompt:
Blur background

Interaction:
C

Image:
thumb_v3.png

────────────────────────────────────

Message 4

Prompt:
Make colors more vibrant

Interaction:
D

Image:
thumb_v4.png
```

The latest session state points to Message 4 while preserving the complete generation timeline.

---

# Benefits of this Design

- Session-based workflow instead of isolated requests.
- Complete conversation history for every generation.
- Efficient Gemini integration using `previousInteractionId`.
- Provider-independent architecture that can support OpenAI or future models.
- Immutable message history simplifies debugging and future features.
- Ready for future enhancements such as branching, version comparison, or collaborative editing without requiring database redesign.

---

# Development modules (todos)

Build the generation-worker in this order. Each module: routes → controller → service → prisma.

## Checklist

- [ ] **Models** — admin CRUD; public `GET` visible models (title, description, aspect/resolution lists); seed script
- [ ] **Templates** — categories + thumbnail library; admin CRUD; public browse by category
- [ ] **Sessions** — create / list / get thread; maintain `latest_*` pointers
- [ ] **Messages** — user + assistant turns; validate `model_id`, aspect/resolution, refs; `reference_id` wiring
- [ ] **Jobs / billing bridge** — `generation_jobs` + idempotency; wallet quote/reserve (sync); capture/release via events
- [ ] **Prompt enhance** — module with `kind = prompt_enhance`; set `used_enhanced_prompt` / `enhanced_prompt`
- [ ] **Providers (adapters)** — Gemini Interactions + OpenAI; shared `generate` / `edit` interface
- [x] **Storage** — S3 upload for user refs + generated images
- [ ] **Workers / consumers** — RabbitMQ: job → adapter → S3 → `completed` / `failed` events; update session head
- [ ] **Internal HTTP + gateway** — `/internal/...` for gateway; public proxies (sessions, refine, poll, models, templates)

## Suggested folder layout

```
src/
  modules/models|templates|sessions|messages|jobs|enhance/
  providers/gemini|openai/
  storage/
  consumers/
  routes/
```
