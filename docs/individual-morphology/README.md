# Individual morphology renderer

This extends the photo-fidelity renderer without replacing the UI or simulation contract. `simulate()` is unchanged. No runtime dependencies, downloaded textures, models, or postprocessing were added.

## Data path

`VisionPlantProfile` asks Claude for existing botanical/care fields plus `visual` observations and `individual` landmarks. Saved `PlantProfile` objects may omit both additions. Zod validates normalized ranges and unique leaf IDs. Analyze assigns a SHA-256 photo seed; refine retains it. Temperature zero reduces inference variation but does **not** guarantee identical model responses. Given the same profile and simulation state, geometry is deterministic.

`shared/species-profile.ts` contains topology, blade, branching and growth defaults. `shared/morphology.ts` describes the photographed specimen. `visualOf()` resolves both with legacy fallbacks; `architecture.ts` generates stable organ identities, spline paths and leaf transforms.

Landmarks specify blade bases relative to the soil line: x is normalized half-canopy width, y is plant height, size is relative blade length. Three depth layers resolve overlaps conservatively. Positions and angles are interpreted in the initial viewer camera basis. Rotating the camera exposes inferred hidden geometry, not additional photo evidence. Up to 32 major leaf observations and 160 procedural leaves are supported.

## Geometry and appearance

- Curved, progressively tapered stems and hierarchical branches share one mesh.
- Leaves have closed top/bottom/rim geometry, folds, curl, asymmetry and actual fenestration holes. Instance maturity morphs both surface and shadow geometry continuously.
- Seeded IDs keep observed leaves stable when arrays reorder or a neighboring observation changes.
- Growth adds leaves, branches and root laterals; stems thicken and older leaves age. New geometry emerges continuously.
- Lightweight standard materials add vein relief, underside tint, small roughness variation and subdued emissive fill. The latter approximates translucency; it is not a physical transmission model.
- Neutral procedural studio environment, ACES/sRGB, self-shadows and contact shadows replace the competing warm environment. Crease shading approximates local occlusion; there is no screen-space AO pass.
- Empty stem meshes are omitted and empty bounds are ignored during camera fitting, preserving grass and succulent framing.

## Verification

Run `npm run typecheck`, `npm run build`, `node --import tsx docs/fidelity/verify.ts`.

With `PORT=8790 USE_MOCK=true npm run dev -w server`, run `node --import tsx docs/individual-morphology/verify.ts`. Tests cover schema retention/rejection, structured-output conversion, landmark reorder invariance, independent observation edits, growth continuity, stable IDs, closed leaf shells, finite geometry, and mock analyze/refine preservation.

For screenshots, start Vite and run `PLAYWRIGHT_MODULE=/path/to/playwright FIDELITY_URL=http://localhost:5186 node docs/individual-morphology/capture.cjs`. Playwright is an external QA tool, not a project dependency.

The checked-in 18 captures cover 390×844 and 1280×900 at DPR 1: observed specimen, growth, wilt, and six architecture fixtures. `metrics.json` reports no browser errors, at most 19 steady-frame calls and 132,258 submitted triangles for these non-cutaway views, including shadow passes. These are desktop Chrome measurements at mobile viewport sizes, not physical-phone FPS benchmarks. Demand rendering remains enabled. The dev lab is excluded from production output.

## Limits

The asymmetric `observed` fixture is hand-authored test data, not an uploaded photo reconstruction. Mock analyze always returns it. Live Claude extraction has not been evaluated in this run. The visible silhouette quality still depends on observation quality; occluded topology and depth are estimates. Leaf rims remain visibly faceted in close-up, particularly thick succulent blades. No claim of exact reconstruction or botanical growth prediction is made.

The production build succeeds with Vite's existing large-bundle warning (about 1.33 MB JS / 375 KB gzip). The other teams' branches have not been merged into this isolated change.

Additional smoke checks opened the app's Scan tab (two photo file inputs) and rendered 24-month cutaway views: 61 calls for observed Monstera, 131 for basil, 105 for cactus, all below 400. No JavaScript exceptions occurred; Chrome reported one unclassified 404 resource message when opening the app root, so this smoke check is not recorded as a clean console run.
