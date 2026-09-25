# Rootsight

> **Take a photo of your plant and see its future.**

Snap or upload a photo of a plant. Claude (vision) identifies it and returns a strict JSON `PlantProfile`
(species, a mini wiki, care, morphology). The app grows that plant procedurally in 3D: a time slider simulates months of growth, a soil
cut-away shows the roots spreading, and a watering slider makes it wilt if you neglect it. Two twists:
a **self-check loop** (we screenshot our own render and Claude corrects the profile until it matches the
photo) and **"what if" questions** ("What if I water every 2 weeks?") where Claude adjusts the plant and explains why.
A growth tracker tells you when it reaches a given height ("90 cm in ~23 weeks"). **My plants** keeps your
collection with watering reminders, and **Discover** lets you browse other plants.

The target is an **iPhone app**: `mobile/` is the Expo (React Native) app. `web/` is the phone-first web prototype, kept until its screens are ported.

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

Other scripts: `npm run typecheck` (whole repo, incl. mobile), `npm run build` (web bundle) and `npm run dev:mobile` (API + Expo, see below).

## Preview

- **Mac browser:** `npm run dev`, open http://localhost:5173 (shows as a phone-sized frame).
- **Inside VS Code:** no extension needed. `Cmd+Shift+P` -> **Simple Browser: Show** -> `http://localhost:5173`.
- **Your iPhone** (same Wi-Fi): `npm run dev:phone`, then open the `Network:` URL Vite prints (e.g. `http://192.168.1.12:5173`).
  In Safari: Share -> **Add to Home Screen** to run it full-screen like an app.
  `dev:phone` exposes the dev server to your whole network, so on shared hackathon Wi-Fi keep `USE_MOCK=true` or stop it after testing.

## Mobile app (Expo)

`mobile/` is an Expo SDK 57 app (React Native 0.86, React 19.2) with Expo Router tabs: Plant / My plants / Discover.

```bash
npm run dev:mobile   # API on :8787 + Expo dev server with a QR code
```

- **iPhone:** install Expo Go (SDK 57) and **log in to the same Expo account in Expo Go and in the CLI** (`npx expo login`), which SDK 57 requires.
  If the App Store build doesn't support SDK 57 yet, `npx eas-cli go` builds Expo Go to your TestFlight. Scan the QR code; phone and Mac on the same Wi-Fi.
- **iOS simulator:** press `i` in the Expo terminal (needs Xcode).
- The app calls the API on the machine running Expo (port 8787). Override with `EXPO_PUBLIC_API_URL` (see `mobile/.env.example`); it's bundled into the app, so no secrets.
- The Plant tab has a temporary **Test API** button that calls `/api/analyze` as a smoke check.
- React is pinned to Expo's version (`19.2.3`) for the whole repo via root `overrides`: a second copy of React breaks the app at runtime. Check with `npm ls react` after changing deps, and use `npx expo install <pkg>` in `mobile/` so versions match the SDK.
- 3D will use `expo-gl` + `@react-three/fiber/native` (3d-owner).

## Layout

| Path | What |
|---|---|
| `shared/schema.ts` | **The contract.** zod `PlantProfile` + API payloads. Announce every change to the team. |
| `shared/simulation.ts` | Pure `simulate(profile, month, waterIntervalDays) -> PlantState` and `weeksToHeight()` |
| `shared/fixtures/` | Mock profiles: monstera, basil, cactus |
| `server/src/` | Express API: `claude.ts` (client + schema-validated JSON helper), `prompts.ts`, `routes/` |
| `mobile/` | Expo app: `app/` (Expo Router screens, `(tabs)/`), `components/`, `src/api.ts` (API client, same contract as web) |
| `web/src/` | Vite + React + R3F: `components/` (UI, incl. `MyPlants`, `Discover`), `three/` (procedural plant and roots), `myPlants.ts` (collection in localStorage) |

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
| **3d-owner** | `shared/simulation.ts`, `web/src/three/*`, `SceneCanvas` (L-system branching, leaf shapes per growthForm, warm environment around the plant, roots, wilt animation) |
| **ui-owner** | App layout (iPhone-first), `PhotoUpload`, `PlantInfoPanel`, `Controls`, `MyPlants`, `Discover`, canvas screenshot for `/api/refine`, demo polish, loading states |

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
