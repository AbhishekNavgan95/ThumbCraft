# Generation Worker — Database Visualization

Schema source: [`schema.prisma`](./schema.prisma) · Database: `generation_db`

Chat-style **messages** + **`generation_jobs`** as the wallet `jobId` for charges.

---

## Entity relationship

```mermaid
erDiagram
  generation_models ||--o{ generation_messages : "selected as"
  generation_sessions ||--o{ generation_messages : "has"
  generation_sessions ||--o{ generation_jobs : "has"
  generation_messages ||--o| generation_messages : "assistant references user"
  generation_messages ||--o{ generation_jobs : "billed via"
  template_categories ||--o{ thumbnail_templates : "has"

  generation_models {
    uuid id PK
    Provider provider
    text provider_model_id UK
    text title
    text description
    text_arr supported_aspect_ratios
    text_arr supported_resolutions
    bool visible
    int sort_order
  }

  generation_sessions {
    uuid id PK
    uuid user_id
    text title
    text category
    text latest_interaction_id
    uuid latest_message_id
    uuid latest_assistant_message_id
    SessionStatus status
  }

  generation_messages {
    uuid id PK
    uuid session_id FK
    MessageRole role
    uuid model_id FK
    text original_prompt
    text enhanced_prompt
    bool used_enhanced_prompt
    text required_aspect_ratio
    text required_resolution
    uuid reference_id FK
    text image_url
    MessageStatus status
  }

  generation_jobs {
    uuid id PK
    uuid message_id FK
    GenerationJobKind kind
    GenerationJobStatus status
    int coin_cost
    text idempotency_key UK
  }
```

---

## Role contract (messages)

| Field | `role = user` | `role = assistant` |
|--------|----------------|---------------------|
| `model_id` | FK → `generation_models` | same |
| `original_prompt` | required | null |
| `enhanced_prompt` | optional result text | null |
| `used_enhanced_prompt` | label if enhance was used | `false` |
| `preferences` | wizard filters | `{}` |
| `reference_image_urls` | user / template refs | `[]` |
| `reference_template_ids` | optional analytics | `[]` |
| `required_aspect_ratio` / `required_resolution` | from selected model's lists | null |
| `reference_id` | null | → user message |
| `image_url` + meta | null | generated S3 image |
| `interaction_id` | null | Gemini turn id |
| `status` / `error` / `completed_at` | unused | image job lifecycle |

**Wallet `jobId` is never the message id** — use `generation_jobs.id`.

---

## Jobs (wallet bridge)

| `kind` | Linked `message_id` | Purpose |
|--------|---------------------|---------|
| `prompt_enhance` | user message | Enhance-prompt module charge |
| `generation` | assistant message | Image generation charge |

```
Client Idempotency-Key
        ↓
generation_jobs.id  ───►  wallet reserve / capture / release (jobId)
        │
        ├── kind=prompt_enhance → user message (enhanced_prompt, used_enhanced_prompt=true)
        └── kind=generation     → assistant message (image_url, …)
```

Job status: `created` → `reserved` → `processing` → `captured` | `released` | `failed`

---

## Hierarchy view

```
generation_models            (admin catalog; visible → user picker)
│
generation_sessions
│
├── latest_message_id / latest_assistant_message_id / latest_interaction_id
│
├── generation_messages[]
│     ├─ user: model_id, prompt, aspect/resolution (validated vs model)
│     └─ assistant: model_id, reference_id, image_url, interaction_id, status
│
└── generation_jobs[]        (id = wallet jobId, unique idempotency_key)
```

---

## Flow over time

```
Session
  │
  ├─ (optional) Job E  kind=prompt_enhance  → fills Msg1.enhanced_prompt
  │
  ├─ Msg 1  role=user   used_enhanced_prompt=true  aspect=16:9
  ├─ Msg 2  role=assistant  reference_id=1  status=queued
  ├─ Job G  kind=generation  message_id=2  id=<wallet jobId>
  │           reserve(G) → processing → image → capture(G)
  │           session.latest_* → Msg2 / interaction A
  │
  └─ refine… Msg3 user → Msg4 assistant → Job G2 …
```

---

## Tables

### `generation_models`

Lean admin catalog (from `reference/Gemini-models.json` essentials only).

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | What messages store as `model_id` |
| `provider` | `Provider` | `gemini` \| `openai` |
| `provider_model_id` | TEXT UNIQUE | API id, e.g. `gemini-3.1-flash-image` |
| `title` | TEXT | Selector label |
| `description` | TEXT | Tooltip — model strengths |
| `supported_aspect_ratios` | TEXT[] | UI selector options |
| `supported_resolutions` | TEXT[] | UI selector options |
| `visible` | BOOLEAN | Admin toggle for user picker (`false` by default) |
| `sort_order` | INT | Display order |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Not stored:** alias, grounding flags, thinking, best_for, latency, max refs — keep those in `reference/` docs or adapters if needed later.

**API sketch**
- User: `GET /api/models` → `WHERE visible = true` (include `title`, `description` for tooltips + aspect/resolution lists)
- Admin: full CRUD + `PATCH` visibility / sort

Validate on send: `requiredAspectRatio ∈ model.supportedAspectRatios` and same for resolution.

**Seed from reference file:**

```bash
# from apps/generation-worker (DATABASE_URL in .env)
pnpm db:seed:models
```

Upserts `provider_model_id` from `reference/Gemini-models.json`.
Maps `name` → `title`, `recommended_for` → `description`.
Re-runs update title/description/ratios/resolutions/sort; do **not** overwrite existing `visible`. New rows: flash + pro visible by default; legacy `gemini-2.5-flash-image` hidden.

---

### `generation_sessions`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | |
| `user_id` | UUID | |
| `title` / `category` | TEXT? | |
| `latest_interaction_id` | TEXT? | Gemini head |
| `latest_message_id` | UUID? | Soft pointer |
| `latest_assistant_message_id` | UUID? | Soft pointer |
| `status` | `SessionStatus` | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

No `provider` / `model` on session — chosen per message via `model_id`.

---

### `generation_messages`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | Chat row only (not wallet jobId) |
| `session_id` | UUID FK | CASCADE |
| `role` | `MessageRole` | |
| `model_id` | UUID FK → `generation_models` | RESTRICT delete |
| `original_prompt` / `enhanced_prompt` | TEXT? | user |
| `used_enhanced_prompt` | BOOLEAN | user label |
| `preferences` | JSONB | user |
| `reference_image_urls` | TEXT[] | user |
| `reference_template_ids` | TEXT[] | optional analytics |
| `required_aspect_ratio` / `required_resolution` | TEXT? | must be in model lists |
| `reference_id` | UUID FK? | assistant → user |
| `image_url` + mime/width/height | | assistant |
| `interaction_id` | TEXT? | assistant |
| `status` / `error` / `completed_at` | | assistant |
| `metadata` / `created_at` | | |

---

### `generation_jobs`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | **Wallet `jobId`** |
| `user_id` | UUID | |
| `session_id` | UUID FK? | SET NULL |
| `message_id` | UUID FK? | assistant (generation) or user (enhance) |
| `kind` | `GenerationJobKind` | `generation` \| `prompt_enhance` |
| `status` | `GenerationJobStatus` | billing/queue lifecycle |
| `coin_cost` | INT | Authoritative charge amount |
| `idempotency_key` | TEXT UNIQUE | Client key |
| `error` / timestamps | | |

---

## Enums

```
SessionStatus         active | archived
MessageRole           user | assistant
MessageStatus         queued | processing | completed | failed
Provider              gemini | openai
GenerationJobKind     generation | prompt_enhance
GenerationJobStatus   created | reserved | processing | captured | released | failed
```

---

## Wallet integration (recommended)

| Step | Mechanism | Why |
|------|-----------|-----|
| **Quote** | Sync HTTP gateway → wallet | Need cost before UI confirm |
| **Reserve** | Sync HTTP before enqueue | Fail fast with 402; don’t queue unpaid work |
| **Capture** | Consumer on `generation.completed` | Worker already async; wallet reacts to event |
| **Release** | Consumer on `generation.failed` | Same; no generation→wallet HTTP on failure path |

Do **not** make the generation worker call wallet over HTTP for capture/release — publish events and let wallet consume with `idempotency_key = jobId`.

Enhance-prompt module: same pattern with `kind = prompt_enhance` and its own `generation_jobs.id` as wallet `jobId`.

---

## Relations summary

| From | To | On delete |
|------|-----|-----------|
| messages.session_id | sessions.id | CASCADE |
| messages.model_id | models.id | RESTRICT |
| messages.reference_id | messages.id | SET NULL |
| jobs.session_id | sessions.id | SET NULL |
| jobs.message_id | messages.id | SET NULL |
| templates.category_id | categories.id | CASCADE |

Session `latest_*` pointers are application-managed (not FKs).

---

## Template library (admin)

Catalog separate from chat history. Admin CRUD; users browse **active** templates by category.

```mermaid
erDiagram
  template_categories ||--o{ thumbnail_templates : "has"

  template_categories {
    uuid id PK
    text slug UK
    text name
    text description
    int sort_order
    bool active
  }

  thumbnail_templates {
    uuid id PK
    uuid category_id FK
    text title
    text image_url
    text preview_url
    text aspect_ratio
    text_arr tags
    int sort_order
    bool active
    uuid created_by
  }
```

### Selection flow

```
Library UI → user picks template(s)
           → copy template.image_url into message.reference_image_urls
           → store template.id in message.reference_template_ids (analytics)
           → NO live FK to template (history safe if admin archives later)
```

| Table | Purpose |
|-------|---------|
| `template_categories` | Sections (Gaming, Tech, …); unique `slug`; `active` + `sort_order` |
| `thumbnail_templates` | S3 `image_url` (+ optional `preview_url` for grid) |

**API sketch:** public `GET /api/templates?category=gaming`; admin create/update/deactivate gated by auth `admin` role. Upload to S3 on admin create, persist CDN URL.
