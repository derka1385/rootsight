# Rootsight

> **Take a photo of your plant and see its future.**

Snap or upload a photo of a plant. Claude (vision) identifies it and returns a strict JSON `PlantProfile`.
The web app grows that plant procedurally in 3D: a time slider simulates months of growth, a soil
cut-away shows the roots spreading, and a watering slider makes it wilt if you neglect it. Two twists:
a **self-check loop** (we screenshot our own render and Claude corrects the profile until it matches the
photo) and **"what if" questions** ("What if I water every 2 weeks?") where Claude adjusts the plant and explains why.

```
photo -> Claude vision -> PlantProfile JSON -> simulate() -> procedural Three.js
```

## Quickstart

Requires Node 20.12+.

```bash
npm install
cp server/.env.example server/.env
npm run dev          # API on :8787, web on http://localhost:5173
```

`USE_MOCK=true` (the default) serves the fixtures in `shared/fixtures/` with a fake 600 ms delay, so no
API key is needed. For real Claude calls, set `ANTHROPIC_API_KEY` and `USE_MOCK=false` in `server/.env`.
The key lives **only** in `server/.env` (gitignored). Never put it in `web/`.

Other scripts: `npm run typecheck` (whole repo) and `npm run build` (web bundle).

## Layout

| Path | What |
|---|---|
| `shared/schema.ts` | **The contract.** zod `PlantProfile` + API payloads. Announce every change to the team. |
| `shared/simulation.ts` | Pure `simulate(profile, month, waterIntervalDays) -> PlantState` |
| `shared/fixtures/` | Mock profiles: monstera, basil, cactus |
| `server/src/` | Express API: `claude.ts` (client + schema-validated JSON helper), `prompts.ts`, `routes/` |
| `web/src/` | Vite + React + R3F: `components/` (UI) and `three/` (procedural plant and roots) |

API (all `POST`, JSON):
- `/api/analyze` `{imageBase64, mediaType}` -> `PlantProfile`
- `/api/refine` `{photo, renderScreenshot, profile}` -> `PlantProfile`
- `/api/whatif` `{profile, question}` -> `{profile, explanation}`

Real-mode responses are validated with zod. On failure the server retries once with the error appended,
then returns `502 {error, details}`.

## Team split

Search for your tag: `TODO(claude-owner)`, `TODO(3d-owner)`, `TODO(ui-owner)`.

| Owner | Owns |
|---|---|
| **claude-owner** | `prompts.ts`, `claude.ts`, routes, refine loop, what-if |
| **3d-owner** | `shared/simulation.ts`, `web/src/three/*`, `SceneCanvas` (L-system branching, leaf shapes per growthForm, roots per root type, wilt animation) |
| **ui-owner** | App layout, `PhotoUpload`, `PlantInfoPanel`, `Controls`, canvas screenshot for `/api/refine`, demo polish, loading states |

Shared contract = `shared/schema.ts`. Changes to it must be announced to the team.

### Git workflow

- Branches: `claude/*`, `3d/*`, `ui/*` (e.g. `3d/leaf-shapes`)
- **Merge small, merge often, pull main before pushing.**
- Run `npm run typecheck` before you push.

## 90-second demo script (placeholder)

1. **Hook (10s):** TODO
2. **Live photo (20s):** TODO: snap a real plant, Claude identifies it
3. **Growth slider (15s):** TODO: drag months 0 -> 24
4. **Roots (10s):** TODO: orbit below ground and show the cut-away
5. **What-if (20s):** TODO: "What if I water every 2 weeks?"
6. **Refine loop (15s):** TODO: render vs photo, Claude corrects it
