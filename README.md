# Canvio

### *Build ideas the way you build cities.*

> The first collaborative workspace built on maps. Free. Open source. No signup.

Canvio is an infinite canvas where every element is a **Living Node** — objects that understand their content and connect with meaningful **Relations**. Drop a map, draw, write, connect — all in real-time with anyone, no account needed.

## ✨ Features (Phase 0)

- 🎨 **Infinite Canvas** — pan, zoom, draw without limits
- 🗺️ **Living Map Node** — real interactive maps with markers, satellite view, multiple tile layers
- 📝 **Sticky Notes** — colored cards with rich text
- ✏️ **Freehand Drawing** — pressure-sensitive, beautiful strokes
- 🔗 **Semantic Relations** — labeled connections that carry meaning
- 👥 **Real-Time Collaboration** — live cursors, instant sync via Yjs
- 🔗 **Share via URL** — no signup required, just send the link
- 💾 **Auto-Save** — never lose your work
- 🌙 **Dark Mode** — premium dark theme by default

## 🚀 Quick Start

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

## 🏗️ Architecture

```
canvio/
├── packages/
│   ├── core/           # Canvas engine, types, Zustand store
│   ├── collaboration/  # Yjs real-time sync
│   ├── objects/        # Living Node implementations
│   └── ui/             # Design system, icons, components
├── apps/
│   ├── web/            # React + Vite frontend
│   └── server/         # Fastify + Yjs WebSocket backend
└── docker/             # Docker Compose setup
```

**Tech Stack:** React 19, TypeScript, Vite, Zustand, Yjs, Leaflet, Fastify, PostgreSQL

## 🤝 Contributing

Canvio is open source under the AGPL-3.0 license. Contributions are welcome!

## 📄 License

[AGPL-3.0](LICENSE) — free to use, modify, and distribute. If you run a modified version as a service, you must share your changes.

---

**❤️ Support Canvio** — If this project helps you, [support its development](https://github.com/sponsors/canvio).
