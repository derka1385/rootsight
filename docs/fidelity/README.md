# Photo fidelity validation

## Reproduce

Use the repository's existing dependencies. No new runtime dependency or downloaded asset is required.

```sh
USE_MOCK=true npm run dev
# Open http://localhost:5173/src/three/fidelity.html (use the port Vite reports).
# For a dedicated web preview alongside another checkout:
npm run dev -w web -- --port 5184 --strictPort

npm run typecheck
node --import tsx docs/fidelity/verify.ts
npm run build

# Use an existing Playwright installation; this does not add it to package.json.
FIDELITY_URL=http://localhost:5184 PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
  node docs/fidelity/capture.mjs
```

`CHROME_CHANNEL` defaults to `chrome`. `FIDELITY_OUTPUT` defaults to `docs/fidelity`. `FIDELITY_PROFILES` accepts comma-separated lab preset names. The viewport is 390×844 at DPR 1. The harness fails on browser errors or measured peak draw calls ≥400 and writes `metrics.json`.

The page is a separate Vite development entry, not included in the production application bundle. Load any complete profile JSON (with optional `visual`) and a local reference image to view them side by side. Core profile fields are Zod-validated; the adapter bounds optional visual fields. The reference image is a browser object URL and is never uploaded or copied into Git. “Save render” exports a PNG from the same canvas used by the refine loop. Query parameters: `profile`, `month`, `water`, `cutaway`, `capture`.

## Evidence

- Baseline: `96cec66`, Home → Explore, month zero, ideal watering, 390×844. See [diagnosis](diagnosis.md) for the five gaps recorded before implementation.
- Product comparison: `before-{monstera,basil,cactus}.png` versus `after-{monstera,basil,cactus}.png`, same original fixture data. Files named `*-today`, `*-grown`, `*-wilt` and `*-cutaway` are lab captures.
- All three original fixture profiles validate without `visual`. The adapter also compiles against the Claude owner's concurrent schema without modifying it.
- Full `npm run typecheck` (web/shared/server and mobile), `npx tsc -p .`, production build, and the regression script pass. Locked dependencies were installed outside the repo for the missing mobile packages; manifests and lockfile are untouched. The build retains its existing large-bundle warning.
- Regression script checks deterministic layouts, exact current leaf counts, finite vertex/normal/matrix data, legacy/partial/malformed optional inputs, owner aliases, architecture selection, and existing-leaf continuity across a birth boundary.
- 24 headless fixture/photo captures (today, 24 months, dry at 60-day watering, and cutaway), no browser errors. Maximum measured draw calls: **87**. The full-pot views use **15–19**, cutaway **41–87**, including shadow draws reported by Three in measured frames. Probe tracks maximum as well as settled counts; startup environment generation is outside this measurement. No physical-device FPS claim is made.
- Additional synthetic vine, grass, succulent rosette and tree presets pass 16 equivalent captures; not asserted to reconstruct reference photographs. Example captures are in `architecture-*.png`, measurements in `architecture-metrics.json`.

## Three actual photo comparisons

Photos are linked in the [diagnosis](diagnosis.md) and remain outside the repo. Hand-estimated profiles are in [photoProfiles.ts](../../web/src/three/photoProfiles.ts). Counts include estimated occluded foliage and dimensions have no calibrated physical scale.

| Reference | Hand estimates | Render assessment |
| --- | --- | --- |
| Kipogeorgiki monstera in orange nursery pot | 60 cm above soil, 16 blades up to 32 cm, 4 basal stems, 0.8 blade width/length, moderate perforation, pot diameter 0.37× plant height | Reads as an upright clustered split-leaf aroid, with separate broad blades and holes. Silhouette is fuller than the fixture. Still too regular; exact petiole angles and individual blade outlines are not reconstructed. |
| Carrefour dense basil in orange nursery pot | 22 cm, 54 leaves up to 9 cm, 6 stems, opposite arrangement, cupped blades, 0.6 pot diameter/height | Broad paired foliage creates a fuller kitchen-herb canopy. Container color/scale and visible mature blade size differ from the sparse original fixture. Reference canopy remains denser near the soil and has more irregular side shoots. |
| Klorofyllverket young cactus in blue-grey plastic pot | 7 cm body, width/height 0.85, 13 ribs, white 1.4 cm spines, no offsets, pot diameter 1.05× body height | Reads as a pale-spined young barrel in the matching dark container. Ribbed globe and radial areoles replace the almost spineless dome. Reference has more tuberculate flesh and a woollier crown. |

These are qualitative visual acceptance checks, not a claim of pixel-accurate reconstruction. The saved profiles, viewpoint, dimensions, and captures make subsequent edits comparable. For stricter scoring, outline the plant in both images and compare silhouette IoU after aligning soil line and scale; record leaf/stem counts separately rather than treating different backgrounds as plant error.

## Contract and limits

See [visual-profile-proposal.md](../visual-profile-proposal.md) for the Zod snippet, one-line photo estimates, defaults, alias table, and exact requested schema/prompt changes. Live analyze/refine needs the schema owner's integration; the base branch strips unknown fields.

- One global description cannot place a particular yellow leaf or match each petiole, hole or variegated patch. A future optional per-leaf landmark list would be needed for that precision.
- Profile height, blade length, spread and internodes interact. Spread is a structural target; impossible combinations are not solved by distorting blades to a bounding box. Rendered tip height can differ from the profile's scalar height. The camera fits actual mesh bounds.
- Dense plants cap at 160 blades / 12 basal stems; cactus at 32 ribs / 6 offsets. Additional growth remains continuous in size, but density stops increasing at the cap.
- Succulent rosettes use curved two-sided blades, not volumetric succulent tissue. Pads, vines and small trees are coarse architectures. Branch hierarchy/branchingDepth is not reconstructed from a photo.
- Owner `notched` tips, `wavy` margins, pests, and fuzzy cactus crowns remain unmodeled. Owner fillRatio is not applied twice over canopy/pot dimensions.
- Pots stay at their photographed size during simulated growth. The product retains its educational cutaway and compresses inferred roots to fit the pot; displayed root measurements still come unchanged from `simulate()`. The lab defaults to an intact container for photo comparison. Trailing plants use a simple pedestal so foliage clears the table.
- No schema, prompt, server, simulation, fixture, package, or mobile source changes. `frameloop="demand"` and `preserveDrawingBuffer` remain enabled. All textures and geometry are procedural, and per-plant resources are disposed on unmount.
