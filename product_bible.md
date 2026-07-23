# The Canvio Product Bible

> *This document is the soul of the project.*
> *Every technical decision, every design choice, every marketing word should pass through it.*
> *If something contradicts this document, this document wins.*

---

## The Canvio Manifesto

> We don't believe ideas belong in folders.
>
> We don't believe creativity should be linear.
>
> We don't believe you should need ten tools to think one thought.
>
> We believe people think in places, connections, and relationships.
> We believe a map is worth a thousand spreadsheets.
> We believe the best workspace is one that thinks with you.
>
> That's why we built Canvio.
>
> One World. Everything connected. Nothing scattered.
>
> ***Build ideas the way you build cities.***

---

## Product Principles

These are non-negotiable. Every design decision, every feature, every pixel must pass through them.

| # | Principle | What it means in practice |
|---|---|---|
| 1 | **Fast before fancy** | A fast, ugly feature beats a slow, beautiful one. Performance is a feature. |
| 2 | **One click less** | If something takes 3 clicks, make it 2. If it takes 2, make it 1. If it takes 1, make it zero. |
| 3 | **Everything is spatial** | If a feature can't be represented spatially on the World, it doesn't belong in Canvio. |
| 4 | **No dialog unless necessary** | Modals, popups, and confirmation dialogs break flow. Inline editing. Undo instead of "Are you sure?" |
| 5 | **The World is always alive** | Auto-save. Real-time sync. Live cursors. The user should never feel the World is "frozen." |
| 6 | **Zero friction** | No signup to start. No install. No onboarding wizard. Draw in 2 seconds or we failed. |
| 7 | **Never interrupt creativity** | No notifications during drawing. No tooltips covering the canvas. No "rate this app." Creativity is sacred. |

---

## 1. Why Does Canvio Exist?

**Because humans think in space, not in files.**

When you plan a trip, you don't write a linear document — you imagine a map with pins, routes, and notes scattered around it. When you study, you spread books, notes, and diagrams across a desk. When you design a building, you sketch on paper, pin references around it, draw arrows between ideas.

But every tool today forces you into **files**. A document here. A spreadsheet there. A map in another tab. A chat in another app. Ten tools open. Nothing connected.

**Canvio gives you one space where everything connects.**

Not a whiteboard. Not a document editor. Not a project manager.

A **World** where ideas live, relate, and evolve together.

---

## 2. What Will We Never Build?

These are our **anti-patterns**. If a feature request falls into any of these, the answer is always no.

| We will NEVER be... | Because... |
|---|---|
| A **document editor** (like Google Docs / Notion) | We are spatial. Not linear. Text is a Node, not the product. |
| A **chat application** (like Slack / Teams) | Communication happens *on the World*, not beside it. |
| A **file storage service** (like Dropbox / Google Drive) | Files are Nodes with behavior. Not dead uploads. |
| A **social network** (like Twitter / Facebook) | Open Spaces are for collaboration, not broadcasting. |
| A **general-purpose AI chatbot** (like ChatGPT) | Our AI builds spatially. It doesn't just answer questions. |
| A **tool that requires signup to be useful** | The first draw must happen in under 2 seconds. No gates. |

**The test**: If a feature makes Canvio feel like "another app with an infinite canvas stuck on," we don't build it. Every feature must make the **spatial experience** better.

---

## 3. What Makes Us Unique?

Three things. In this order.

### 3.1 — Spatial Thinking (The Philosophy)

No competitor thinks spatially. They all think in **containers** — text boxes, image frames, sticky notes. Their canvases are just fancier desktops where you drag rectangles around.

Canvio's World is different. Every Node **knows what it is**. Every Relation **carries meaning**. The space itself **helps you think**.

This isn't a feature. It's a paradigm. You can't copy it with a sprint.

### 3.2 — Living Nodes (The Architecture)

A PDF in Miro is a rectangle that shows pages.
A PDF in Canvio *understands its content*.

An image in FigJam is a bitmap.
An image in Canvio *sees what's inside it*.

A connection in Excalidraw is a line.
A Relation in Canvio knows *"this report is based on that data."*

**Every Node has awareness. Every Relation has meaning.**

### 3.3 — Maps as Native Citizens (The Proof)

Maps are the most spatial thing that exists. No infinite canvas has them. We do.

This is our day-one proof that Canvio thinks differently. When someone drops a Living Map Node onto their World and it *actually works* — zoom, satellite, markers, Relations to sticky notes — they get it. Instantly.

Maps are where we start. But the idea is bigger than maps.

---

## 4. Who Is the First User?

**Not "everyone."**

### The First 1,000 — Spatial Workers (Phase 0–1)

People whose daily work is **inherently spatial**:

| Who | Why they need Canvio | What they use today |
|---|---|---|
| **GIS Engineers** | Collaborate on map data with reports, images, measurements | ArcGIS (expensive, not collaborative), QGIS (not real-time) |
| **Urban Planners** | Pin projects on maps, connect to documents, discuss spatially | Miro (no maps) + Google Earth (no collaboration) |
| **Architects** | Site analysis boards with maps, photos, sketches, reports | Multiple disconnected tools |
| **Emergency Management** | Incident boards with real-time map, photos, status, assignments | Fragmented radio + email + GIS |
| **University Researchers** | Fieldwork boards with map locations, data, photos, notes | Paper + spreadsheets + presentations |

**These people will find Canvio immediately valuable because maps on canvas isn't a "nice to have" for them — it's the missing tool they've been waiting for.**

### The Next 10,000 — Knowledge Workers (Phase 2)

| Who | Why |
|---|---|
| **Students** | Study boards with PDFs, videos, mind maps, notes — all connected |
| **Product Teams** | Roadmaps, wireframes, data, research — spatially organized |
| **Researchers** | Literature review boards with semantic connections between papers |
| **Teachers** | Interactive lesson boards shared with students in real-time |

### The Next 100,000 — Everyone (Phase 3)

| Who | Why |
|---|---|
| **Content creators** | Visual brainstorming and planning |
| **Consultants** | Client presentations on interactive boards |
| **Travel planners** | Trip planning on real maps |
| **Conference organizers** | Live Space events |
| **Anyone with complex ideas** | The "Operating System for Ideas" becomes real |

> [!IMPORTANT]
> **Marketing for Phase 0 speaks to spatial workers. Not "everyone."**
>
> ❌ "The infinite canvas for everything"
>
> ✅ "The first collaborative workspace built on maps. Free. Open source. No signup."

---

## 5. The Magic Moments

These are the specific moments where a user **falls in love** with Canvio. Every design decision exists to make these moments happen.

### ✨ Magic Moment 1 — The First Stroke
The user opens `canvio.io`. No login. No popup. They click and drag.

A beautiful, pressure-sensitive stroke appears. Smooth. Immediate.

*They feel: "This is fast."*

### ✨ Magic Moment 2 — The Living Map
They click the map icon. A real, interactive map appears on their World. They zoom into their city. Switch to satellite view. Drop a marker.

*They feel: "Wait... this is a real map? On a canvas?"*

### ✨ Magic Moment 3 — The First Relation
They drag an arrow from a sticky note to a point on the map. The connection snaps. They type a label: "Site visit location."

*They feel: "These aren't just lines. This means something."*

### ✨ Magic Moment 4 — The Portal
They copy the URL. Send it to a colleague. The colleague opens it.

No signup. No "accept invitation." Just... the World. Immediately.

*They feel: "That was... it? Just a link?"*

### ✨ Magic Moment 5 — The Living Cursor
The colleague starts drawing. The user sees their cursor move. Sees their name. Sees their strokes appear in real-time.

Two people. One World. Alive.

*They feel: "This is Google Docs, but for everything."*

### ✨ Magic Moment 6 — The Return
A week later. The user opens the URL. Everything is exactly where they left it. But there's more — the colleague added markers, notes, photos.

The World grew while they were away.

*They feel: "This is alive."*

### ✨ Magic Moment 7 — The Companion *(Phase 2)*
After an hour of working, a gentle suggestion appears:

> 💡 *"I noticed you have 3 notes about the same location. Want me to group them?"*

Not a chat. Not a popup. A quiet, spatial awareness.

*They feel: "It... understands what I'm doing."*

### ✨ Magic Moment 8 — The Spatial AI *(Phase 2)*
The user types: "Plan a field visit for three priority sites."

The AI doesn't reply with text. It *creates*: a global map, a checklist, a timeline, connected notes, markers on key locations. All as real Nodes with real Relations.

*They feel: "I've never seen anything do this."*

> [!TIP]
> **Every sprint, ask: "Which Magic Moment are we making better?"** If the answer is "none," reconsider the sprint.

---

## 6. What Makes a User Return?

| Reason | How |
|---|---|
| **Their work is still there** | Auto-save. Open the URL → everything's exactly where they left it. |
| **Someone else added to it** | Real-time. They shared the link. A colleague added markers and notes. |
| **It's faster than the alternative** | One tab vs. ten. One World vs. ArcGIS + Google Docs + Miro + Email. |
| **The map is alive** | They can switch to satellite, zoom into a site, pin an image to exact coordinates. No other canvas does this. |
| **The Relations tell a story** | Their board isn't just scattered objects — it's a connected web of meaning. They can *see* how ideas connect. |
| **Phase 2: The ambient AI notices things** | "You haven't updated the site report in 2 weeks." "These 3 notes say similar things." |
| **Phase 2: The spatial AI builds for them** | "Create a site analysis board for project X" → map + checklist + timeline + notes appear. |

**The core loop:**
```
Create a World → Add Nodes → Connect with Relations → Share the link → Others contribute → Come back to see what changed
```

---

## 7. Why Would They Pay?

> *"The free product is great. The paid product is intelligent."*

### Free (forever)
Everything you need to work spatially:
- Unlimited Worlds
- All core Nodes (drawing, text, sticky notes, maps, shapes, images)
- Relations with labels
- Real-time collaboration (3 people per World)
- Share via link, no signup
- Auto-save
- PNG export

**The free tier must feel generous, not crippled.** A user should never hit a wall that makes them angry. They should hit a moment that makes them think *"wow, this could be even better."*

### Pro ($8/month)
For people who use Canvio daily:
- Unlimited collaborators per World
- Ambient AI suggestions
- Spatial AI — 50 creations/day
- Semantic Relations (knowledge graph)
- Version history (unlimited)
- 10 GB storage
- PDF + SVG export
- Living PDF, Living Video, Living Code Nodes

### Team ($15/user/month)
For organizations:
- Everything in Pro
- Private team workspace
- Admin controls
- SSO (SAML/OIDC)
- API access
- 100 GB storage
- Live Space up to 5,000 people

### The Donation Model

Not a paywall. A relationship.

```
After 7 days of use, a gentle message appears once:

  ❤️ If Canvio helped you this week, support the project.
     Even $2 makes a difference.

     [ Support Canvio ]     [ Maybe later ]     [ Don't show again ]
```

- **Hall of Supporters** page honors donors by name (opt-in)
- GitHub Sponsors / Buy Me a Coffee / Patreon for recurring support
- The ❤️ icon is always in the footer — never aggressive, always present

---

## 8. Why Would They Recommend It to Others?

The single most important growth question. If a user doesn't share Canvio, it doesn't grow.

**They share because sharing IS the product.**

| Trigger | What they say |
|---|---|
| They create a World and want a colleague to see it | *"Open this link"* — that's it. No signup. No install. Just click. |
| They discover the map | *"Look, you can actually put a map on the canvas"* — screenshot → Twitter/LinkedIn |
| They see someone else's cursor appear | *"This is like Google Docs but for everything"* — the magic moment |
| They find a public board | *"Someone made an incredible [topic] board, check it out"* — Reddit-like sharing |
| They attend a Live Space event | *"842 people on one canvas, it was insane"* — word of mouth |

**The sharing friction is ZERO:**
- No "invite by email"
- No "create account first"
- No "download the app"
- Just a URL. That's it.

---

## The Language of Canvio

> *Keep it simple. Change only what reinforces the philosophy. Keep everything else familiar.*

### Core Terms (Custom — these define Canvio's identity)

| Generic term | Canvio term | Why |
|---|---|---|
| Board / Canvas | **World** | You don't work "on" a World — you work "in" it. Alive, spatial, immersive. |
| Object / Element | **Node** | A Node is part of a network. Nodes connect. Nodes have awareness. |
| Smart Object | **Living Node** | It's alive. It understands its content. It has behavior. |
| Connection / Arrow | **Relation** | Arrows are visual. Relations carry meaning: "based on," "leads to," "contradicts." |

### Familiar Terms (Keep standard — don't make users learn a new language)

| Concept | Term | Rationale |
|---|---|---|
| Share link | **Share link** | Everyone knows what this is. |
| Version history | **Version history** | Industry standard. |
| Templates | **Templates** | No need to rename. |
| Plugins | **Plugins** | WordPress made this universal. |
| AI assistant | **AI assistant** | Familiar. Internal codename "Navigator" for team use. |
| Workspace intelligence | **Smart suggestions** | Descriptive. Internal codename "Companion" for team use. |
| Dashboard / Home | **Home** | Simple. |
| Export | **Export** | Universal. |
| Public boards | **Public Worlds** | Uses our "World" term. Natural. |
| Live events | **Live Space** | Slightly custom. Intuitive enough. |

> [!TIP]
> **Rule of thumb: If a user needs to read documentation to understand a term, it's too custom.** "World" and "Node" and "Relation" are intuitive enough to understand from context. "Portal" and "Launchpad" are not.

---

## A Success Story: Field Operations Without Tool Sprawl

> *This is the story we put on the homepage. Real scenario. Real workflow.*

---

**The Problem:**

A regional operations lead coordinates fast-moving work across multiple sites. When an urgent field update comes in, the team scrambles across 4 tools:

- **GIS tools** for location maps (expensive, specialist workflow)
- **WhatsApp** for team coordination (no structure, messages get lost)
- **Google Docs** for incident reports (linear, no spatial context)
- **Email** for sharing photos and PDFs (slow, no real-time)

By the time information flows between tools, the team has lost the shared picture.

**The Solution — One World:**

The lead opens `canvio.io`. Creates a World. No signup. No license fee.

```
┌─────────────────────────────────────────────────────────────────┐
│  Field Operations — World                                      │
│                                                                 │
│  🗺️ Living Map Node                  📝 Status Board           │
│  ┌─────────────────────┐              ┌───────────────────┐    │
│  │ Satellite view       │              │ ⚠️ Active zones: 3│    │
│  │ 📍 Zone A: Critical  │── status ──▶│ 🔄 Teams deployed │    │
│  │ 📍 Zone B: Moderate  │              │ ✅ Evacuation: 80%│    │
│  │ 📍 Zone C: Watch     │              └───────────────────┘    │
│  └─────────────────────┘                       │                │
│          │                              depends on              │
│     based on                                   │                │
│          │                             ┌───────▼───────┐       │
│  ┌───────▼───────────┐                │ 📸 Field Photos │       │
│  │ 📄 Flood Risk PDF  │                │ Zone A: 12 imgs │       │
│  │ (Living: searchable,│── supports ──▶│ Zone B: 5 imgs  │       │
│  │  AI can summarize)  │               └─────────────────┘       │
│  └────────────────────┘                                         │
│                                                                 │
│  👥 8 team members online — all seeing the same World           │
└─────────────────────────────────────────────────────────────────┘
```

She shares the link. 8 team members join. No signup. They see her cursor. She sees theirs.

**The Result:**

- Response time: **2 hours → 15 minutes**
- Tools needed: **4 → 1**
- Cost: **$0** (vs. $5,000/year for ArcGIS multi-user)
- Training required: **None** (it's a canvas with a map)

> *"We used to coordinate floods by email. Now we coordinate them spatially. In real-time. On one screen."*
> — Dr. Nour, Emergency Management Director *(example scenario)*

---

## The $1M Question

> *"What will prevent the first 1,000 users from going back to the old way?"*

**Answer: The cost of going back is too high.**

Once a spatial worker builds a World with a Living Map, connected Nodes, and shared Relations — going back means:

1. **Splitting their brain** across 4 tools again
2. **Losing the map context** — no other canvas has it
3. **Losing the Relations** — the connections between their ideas disappear
4. **Losing real-time collaboration** — back to email and screenshots
5. **Re-doing the work** — the World contains hours of organized spatial thinking

The switching cost isn't financial. It's **cognitive**. Once you think spatially, going back to files feels like going from Google Maps back to paper maps.

**And the kicker:** it's free. There's no cost to stay. No subscription to cancel. No "trial expired." The only question is: *"Is this better than what I was doing?"*

For spatial workers — GIS engineers, urban planners, emergency managers — the answer is almost certainly yes. Because **nothing else exists** that combines an infinite canvas with real maps and real-time collaboration.

---

## The Soul Test

Before building any feature, ask:

| # | Question | Pass condition |
|---|---|---|
| 1 | Does this make the World feel more alive? | Yes, or don't build it. |
| 2 | Does this help ideas connect spatially? | Yes, or don't build it. |
| 3 | Can a new user discover this in 30 seconds? | Yes, or simplify it. |
| 4 | Does this work without signup? | Yes for core features. |
| 5 | Would a GIS engineer use this tomorrow? | In Phase 0–1, yes. |
| 6 | Does this exist in Miro/Excalidraw/FigJam? | If yes, ours must be meaningfully better. |
| 7 | Is it fast before fancy? | Yes. Performance first. |
| 8 | Is it one click less? | Yes. Reduce friction. |
| 9 | Does it interrupt creativity? | No, or redesign it. |

---

## What Success Looks Like

### 30 Days (Phase 0 Launch)
- `canvio.io` is live
- A user can create a World, draw, add a Living Map Node, create Relations, and share a link — all without signup
- 100 real users have tried it
- At least 10 links were shared with another person

### 90 Days (Phase 1)
- 1,000 users
- 5+ active public Worlds with organic participation
- First Live Space event with 50+ concurrent participants
- First donation received
- Featured in at least one GIS/tech community

### 8 Months (Phase 2)
- 10,000 users
- First Pro subscribers
- Spatial AI and smart suggestions are live
- "Canvio" appears in discussions about spatial collaboration tools

### 14 Months (Phase 3)
- 100,000 users
- Plugin marketplace with community-built Nodes
- Team tier has paying organizations
- Canvio is the default answer to "Is there a collaborative canvas with maps?"

---

> *This is the Product Bible.*
> *Every line of code serves this vision.*
> *Every feature passes the Soul Test.*
> *Every design follows the Principles.*
> *Every moment aims to be Magic.*
>
> ***Now let's build.***

---

> [!IMPORTANT]
> **The documentation phase is over. The next step is Phase 0. The clock starts when you say "Go."**
