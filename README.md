# Canvio

### *Connect ideas. Create knowledge.*

> A visual reasoning workspace where the spatial layout is the thinking — and AI acts as a partner that reads the structure, not a generator that replaces it.

Canvio is an infinite canvas built for structured visual work. Every element is a **Living Node** — an object that understands its content and connects to other objects through **Semantic Relations** that carry logical meaning. Draw freely, connect deliberately, and let the graph intelligence surface what your board is actually saying.

**No signup required.** Open a board, share the URL, start working.

---

## What Canvio Does

### Canvas & Objects
- **Infinite canvas** — pan, zoom, snap grid, multi-select, keyboard-driven workflow
- **8 node types** — sticky notes, text blocks, interactive maps, images, shapes, frames, code blocks, and drawings
- **Freehand ink layer** — pressure-sensitive pen and highlighter on a separate layer that never enters the semantic graph
- **Ink-to-Sticky conversion** — measure a sketch's bounding box and convert it to an editable, connectable note in one click

### Semantic Relations
- **Quick-Connect drag** — drag from any node edge port to connect to an existing note, or drop on empty canvas to auto-spawn a connected sticky
- **10 relationship types** — Related to, Leads to, Based on, Part of, Depends on, Contradicts, Enables, Explains, Causes, Inspired by (plus `same_as`, `example_of`, `mitigates`, `custom` in the data model)
- **Keyboard hotkeys** — press `1`–`9`/`0` while a relation is selected to assign its type instantly
- **Custom vector icons** — each type has a distinct color, dash pattern, animation, and SVG icon rendered directly on the canvas

### Graph Intelligence
- **Reasoning Partner** (`Ctrl+Shift+R`) — local graph analysis with health score (0–100), orphan detection, contradiction pairs, critical path identification
- **Challenge Mode** — AI tests weak assumptions and unanchored claims in your board
- **Socratic Inquiry** — generates follow-up questions from your graph structure
- **AI Navigator** (`Ctrl+K`) — prompt-based board generation that creates structured nodes and relations

### Collaboration & Presentation
- **Real-time sync** — live cursors, instant updates via Yjs with offline IndexedDB fallback
- **URL sharing** — no accounts, no signup, just send the link
- **Presenter mode** — hide editing UI for clean walkthroughs
- **Laser pointer** (`Q`) — guide attention without creating permanent marks
- **Export** — PNG, PDF, and JSON snapshots

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 11+

### Development

```bash
# Install dependencies
npm install

# Start development servers (web + API + WebSocket)
npm run dev
```

The app runs at `http://localhost:5173`

### Self-Hosting (Docker)

```bash
docker compose up
```

### Server-side AI Configuration

Canvio uses **Groq** (`openai/gpt-oss-20b` by default, with automatic model
discovery and fallback) through the API server, with Gemini/OpenAI/Anthropic
as optional fallback providers. Models are pinned server-side — clients cannot
select models. The provider key stays on the server only — never add it to the
web app, a `VITE_*` variable, localStorage, the URL, or a committed file.
Copy `apps/server/.env.example` as a reference and configure these as server
environment variables:

```text
CANVIO_AI_PROVIDER=groq
CANVIO_GROQ_MODEL=openai/gpt-oss-20b
CANVIO_GROQ_API_KEY=<rotated-secret>
CANVIO_ALLOWED_ORIGINS=https://canvio.space,https://www.canvio.space
CANVIO_ALLOW_LOCAL_ORIGINS=false
CANVIO_AI_RATE_LIMIT=10
CANVIO_AI_RATE_WINDOW_MS=60000
```

For Gemini instead, set `CANVIO_AI_PROVIDER=gemini`, `CANVIO_GEMINI_MODEL`,
and `CANVIO_GEMINI_API_KEY`.

For a public deployment, add real user/session authentication before enabling
`CANVIO_REQUIRE_AI_AUTH=true`. Origin checks and rate limits reduce abuse but do
not replace authentication.

---

## Architecture

```
canvio/
├── packages/
│   ├── core/           # Canvas engine, types, Zustand store
│   ├── collaboration/  # Yjs real-time sync with offline fallback
│   ├── objects/        # Living Node plugins (8 types)
│   └── ui/             # Design system, icons (30+), toolbar, components
├── apps/
│   ├── web/            # React + Vite frontend (11 prerendered routes)
│   └── server/         # Fastify + Yjs WebSocket + AI proxy
├── scripts/            # Prerender, smoke tests, e2e
└── docker/             # Docker Compose setup
```

### Key Components

| Component | Path | Purpose |
|---|---|---|
| Canvas | `apps/web/src/components/Canvas/` | Infinite canvas with pan, zoom, snap, selection |
| NodeRenderer | `apps/web/src/components/NodeRenderer/` | Renders all node types with edge ports for Quick-Connect |
| RelationRenderer | `apps/web/src/components/RelationRenderer/` | Semantic line rendering with type-specific visuals |
| RelationInspector | `apps/web/src/components/RelationInspector/` | Floating inspector for relation type, label, and assertions |
| FreeInkLayer | `apps/web/src/components/FreeInkLayer/` | Pressure-sensitive ink, highlighter, eraser (separate from graph) |
| GraphIntelligence | `apps/web/src/components/GraphIntelligence/` | Reasoning Partner panel with graph health analysis |
| AIAssistantModal | `apps/web/src/components/AIAssistantModal/` | AI Navigator for prompt-based board generation |

### Tech Stack

React 19 · TypeScript · Vite · Zustand · Yjs · Leaflet · perfect-freehand · Fastify · filesystem JSON persistence

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select and move |
| `P` | Freehand pen |
| `E` | Stroke eraser |
| `Q` | Laser pointer |
| `1` – `9`, `0` | Assign semantic relation type |
| `Ctrl + K` | AI Navigator |
| `Ctrl + Shift + R` | Reasoning Partner |
| `Space + drag` | Pan canvas |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo |

---

## Project Status

**Phases A & B are complete.** The core workspace is fully functional with semantic relations, freehand ink, graph intelligence, real-time collaboration, and AI-assisted board generation.

**Phase C (next):** Public Worlds (read-only sharing), Board Forking ("Remix this thinking"), and a Community Gallery for discoverable templates.

---

## Contributing

Canvio is open source under the AGPL-3.0 license. Contributions are welcome.

## License

[AGPL-3.0](LICENSE) — free to use, modify, and distribute. If you run a modified version as a service, you must share your changes.
