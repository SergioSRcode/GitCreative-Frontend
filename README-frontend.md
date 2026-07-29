# GitCreative — Frontend

A browser-based digital painting application with Git-style version control. Built with React, TypeScript, and WebGL2.

This is the frontend client. It talks to the [GitCreative-Backend](#) (separate repository) via a REST API.

---

## Features

- **WebGL2 canvas** with DPI-aware rendering and pointer/pressure input (mouse, touch, stylus/tablet)
- **Brush set** — Ink, Pencil, Eraser, Airbrush (soft/medium/hard variants), each with pressure-sensitive opacity and tapering
- **Flood fill** with adjustable color tolerance
- **Layer system** — add/delete/reorder, visibility, opacity, blend modes (Normal, Multiply, Overlay)
- **HSV color picker** with eyedropper and recent colors
- **Undo/redo** via raster checkpoints
- **Git-style version control** — commits, branches, detached HEAD ("time travel"), branch creation from any point in history
- **Visual commit graph** with lane-based branch visualization
- **Side-by-side version comparison** — select any commits across any branches and compare them in a dynamically-sized grid
- **Quick-save** (autosave-style, per-branch) distinct from named commits
- **Canvas zoom & pan**, with mouse wheel, drag, and slider support
- **Keyboard shortcuts** (⌘S save, ⌘Z/⇧⌘Z undo/redo, ⌘P/⌘I pencil/ink, ⌘M pan, right-click eraser toggle)
- **Project gallery** with real content thumbnails, inline rename, import/export of `.gitcreative` files
- **Configurable canvas size** at project creation (presets, custom, or match current screen)
- **Responsive fit-to-screen canvas** — documents keep their true saved resolution regardless of viewport shape or device

---

## Tech Stack

- **Vite** — build tool and dev server
- **React 19 + TypeScript**
- **React Router v6** — client-side routing
- **WebGL2** — all canvas rendering (brush strokes, layer compositing, blend modes)
- **Vitest** — unit tests for pure logic (commit graph algorithm, undo/redo, color conversion, document serialization, flood fill)

---

## Getting Started

### Prerequisites

- Node.js 20+
- A running instance of the [GitCreative-Backend](#) (see that repo's README for setup)

### Install

```bash
npm install
```

### Configure

Create a `.env` file in the project root:

```
VITE_API_URL=http://localhost:3000/api
```

Point this at wherever your backend is running. In production, set it to your deployed backend's public URL.

### Run in development

```bash
npm run dev
```

Opens at `http://localhost:5173`.

### Run tests

```bash
npm run test          # watch mode
npm run test -- --run # single run (CI-style)
```

### Build for production

```bash
npm run build
```

Outputs static files to `dist/` — deployable to any static host (Vercel, Cloudflare Pages, Netlify, etc.).

---

## Project Structure

```
src/
  api/            REST client and typed API functions
  components/     React components (Canvas, Gallery, panels, overlays)
  hooks/          Custom hooks (layers, history/undo, strict-mode guard)
  rendering/      WebGL rendering (BrushRenderer, Compositor, dab geometry)
  shaders/        GLSL vertex/fragment shaders
  types/          Shared TypeScript types
  utils/          Pure logic (stroke processing, color conversion, document
                  serialization, flood fill, commit graph algorithm)
```

---

## Deployment

Deploy as a static site. Recommended: **Vercel** or **Cloudflare Pages**.

- Build command: `npm run build`
- Output directory: `dist`
- Required environment variable: `VITE_API_URL` — must point to your deployed backend

---

## Known Limitations

- Canvas size is fixed at project creation; resizing an existing project's canvas is not yet supported
- Rate limiting on API requests is handled entirely by the backend
- No offline/PWA support yet
