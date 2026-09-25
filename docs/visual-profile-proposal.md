# Visual profile contract — renderer proposal

The renderer consumes `PlantProfile.visual` through `web/src/three/visual.ts`. No shared schema, server, prompt, simulation, or fixture was edited on this branch. Missing groups and fields are independently optional; defaults are derived by the renderer from the existing morphology. `morphology.leaf.countNow`, `lengthCm`, `color`, and `currentHeightCm` remain the single sources for observed count, size, top color, and height. Do not add competing copies of those measurements.

## Proposed Zod block

```ts
const unit = z.number().min(0).max(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Visual = z.object({
  seed: z.string().min(1).max(128).optional(),
  silhouette: z.object({
    widthToHeight: z.number().min(0.15).max(3),
    leanDeg: z.number().min(0).max(65),
    leanDirectionDeg: z.number().min(0).max(360),
    symmetry: unit,
  }).partial().optional(),
  stems: z.object({
    count: z.number().int().min(1).max(12),
    thicknessCm: z.number().min(0.03).max(10),
    internodeCm: z.number().min(0.2).max(60),
    tipColor: hex,
  }).partial().optional(),
  leaves: z.object({
    widthToLength: z.number().min(0.03).max(1.5),
    sizeVariation: z.number().min(0).max(0.8),
    tip: z.enum(["pointed", "rounded"]),
    base: z.enum(["tapered", "heart", "rounded"]),
    edge: z.enum(["smooth", "serrated", "lobed"]),
    fenestration: unit,
    curl: z.number().min(-1).max(1),
    twist: z.number().min(-1).max(1),
    gloss: unit,
    undersideColor: hex,
    arrangement: z.enum(["alternate", "opposite", "whorled", "rosette"]),
    droop: unit,
    variegation: z.enum(["none", "marbled", "sectoral", "margin", "striped"]),
    variegationAmount: unit,
    variegationColor: hex,
  }).partial().optional(),
  cactus: z.object({
    form: z.enum(["globe", "column", "pads", "rosette"]),
    ribs: z.number().int().min(5).max(32),
    spineDensity: unit,
    spineColor: hex,
    offsets: z.number().int().min(0).max(6),
  }).partial().optional(),
  condition: z.object({ yellowing: unit, brownTips: unit, legginess: unit }).partial().optional(),
  pot: z.object({
    color: hex,
    material: z.enum(["terracotta", "ceramic", "plastic", "none"]),
    diameterToHeight: z.number().min(0.1).max(3),
    heightToDiameter: z.number().min(0.3).max(1.5),
    soilVisible: z.boolean(),
  }).partial().optional(),
}).optional();
// PlantProfile: ...existing fields, visual: Visual
```

## Photo estimation and defaults

Angles use the renderer's world coordinates: zero leans toward +X, 90 toward +Z. At the default camera, approximately 34° is screen-right, 124° toward camera, 214° screen-left, 304° away. This is a coarse pose, not camera calibration.

| Field | How to estimate from the photograph; omitted behavior |
| --- | --- |
| seed | Assign a stable specimen token on first analysis and preserve on refine; fallback uses species + initial height + initial count. |
| silhouette.widthToHeight | Compare canopy/body horizontal extent with soil-to-top height, excluding the pot; species-form fallback 0.6–1.1. Target spread, not an exact camera-space constraint. |
| silhouette.leanDeg | Main axis deviation from vertical; 0. |
| silhouette.leanDirectionDeg | Direction of the lean in the fixed camera convention above; 0. |
| silhouette.symmetry | Judge left/right imbalance in canopy/stem directions; 0.75. |
| stems.count | Count distinct soil-emerging stems or crowns, not petioles; 1–3 by architecture (12 rendered maximum). |
| stems.thicknessCm | Estimate visible stem/petiole diameter against leaf length; 0.1–1.2 cm by architecture. |
| stems.internodeCm | Estimate axial distance between leaf-bearing nodes; current height / 5. |
| stems.tipColor | Sample younger stem tissue, excluding glare; existing stemColor. |
| leaves.widthToLength | Widest blade / base-to-tip length, excluding petiole; 0.07–0.95 by existing shape. |
| leaves.sizeVariation | Compare small and mature blades; 0.25, in addition to a modest positional age taper. |
| leaves.tip | Rounded apex versus a taper to a point; pointed. |
| leaves.base | Heart notch, round base or wedge taper where petiole meets blade; heart for aroids, tapered otherwise. |
| leaves.edge | Smooth, toothed or deeply lobed outline, separate from holes; smooth except existing palmate. |
| leaves.fenestration | Relative intensity of margin splits and interior holes on mature blades; 0.6 for fenestrated morphology, otherwise 0. |
| leaves.curl | Signed cup/arch strength; 0.18 (0.45 for succulent rosettes). |
| leaves.twist | Signed axial twist suggested by blade faces turning; 0.12. |
| leaves.gloss | Compare broad specular highlights with matte diffuse areas; 0.55 for aroids, 0.25 otherwise. |
| leaves.undersideColor | Sample a visible underside; if hidden, use a muted lighter botanical green; #7b985e. |
| leaves.arrangement | Identify single alternating nodes, opposite pairs, whorls or basal rosette; inferred from growth form. |
| leaves.droop | Baseline blade sag in the actual photo, independent of simulated water stress; 0.15. |
| leaves.variegation | Classify broad patches, marbling, margins or transverse stripes; none. |
| leaves.variegationAmount | Estimate contrasting blade fraction, avoiding yellow damage; 0 (0.35 if pattern supplied alone). |
| leaves.variegationColor | Sample contrasting tissue away from glare; #ddd9a8. |
| cactus.form | Globe, column, pads or fleshy rosette; inferred from leaf count and growth form. |
| cactus.ribs | Count visible ribs, approximately double a frontal count; 20, capped at 32. |
| cactus.spineDensity | Estimate areole spacing along each rib; 0.65, zero removes spines and areoles. |
| cactus.spineColor | Sample spine clusters separately from the green body; existing leaf color. |
| cactus.offsets | Count visible smaller bodies near the parent; 0, capped at 6. |
| condition.yellowing | Estimate yellowed blade area; 0, concentrated more on older blades. |
| condition.brownTips | Estimate dry tip severity across blades; 0, localized to tips rather than whole-leaf tint. |
| condition.legginess | Judge bare lower stem relative to leaf-bearing upper stem; 0. |
| pot.color | Sample the diffuse container color; #b96743. |
| pot.material | Infer porous clay, glazed ceramic or smooth plastic; terracotta; none hides the container. |
| pot.diameterToHeight | Visible pot opening diameter / current plant height above soil; 0.42–1.5 by form. |
| pot.heightToDiameter | Container height / opening diameter; 0.85. |
| pot.soilVisible | Whether the soil surface is visible; true (false removes only the visible soil top). |

## Integration with the Claude owner's concurrent schema

During development the original checkout acquired a `PlantVisual` block. This branch does **not** replace it. The local adapter accepts these aliases so that merging the two efforts does not require a coordinated rename:

| Owner field | Renderer field |
| --- | --- |
| silhouette.leanDirection | leanDirectionDeg: left/right/toward/away in default camera coordinates |
| silhouette.legginess | condition.legginess |
| stems.countFromSoil | stems.count (bounded to 12) |
| stems.thicknessMm | stems.thicknessCm / conversion from mm |
| leaves.colorUnder | leaves.undersideColor |
| leaves.arrangement=basal | rosette |
| leaves.variegation=streaks/patches/speckled | striped/sectoral/marbled; default amount 0.35 |
| succulent.bodyForm/ribCount | cactus.form/ribs |
| succulent.spineDensity/spineColor/offsets | same fields under cactus |
| pot.diameterCm | diameterToHeight = diameterCm / currentHeightCm |

Owner `acute`/`acuminate` tips currently use the pointed default; `notched` and `wavy` are not modeled exactly. `pests` is not rendered. `fillRatio` is redundant with measured canopy and container dimensions and is not used to rescale a second time.

**Requested owner changes:** keep the existing names if preferred, make every nested visual field independently optional, and add optional stable `seed`, leaf `base`, `curl`, `twist`, `variegationAmount`, stem `tipColor`, pot `heightToDiameter` and `soilVisible`. Existing normalized aliases work without these additions. The snippet above is a standalone proposal, not a request to duplicate both contracts.

**Analyze prompt:** prioritize the actual specimen's silhouette and pot proportions, then leaf/stem counts and blade shape, then finish and localized damage. Estimate only visible evidence; do not fill unseen damage or hidden stems with species averages. Preserve a stable seed. Dimensions without a scale reference are estimates.

**Refine prompt:** compare in order: silhouette/lean, container scale, soil-emerging stems, leaf count and length, blade proportions/perforations, color/finish/damage. Change the smallest subset, preserve seed and unrelated fields. Distinguish photo damage from simulated water stress. A foliage-only screenshot should use the lab's full pot view; the product keeps its educational cutaway.

The existing Zod parser strips unknown `visual` keys on this base branch. Until the owner adds the block, live analyze/refine cannot deliver these controls; use the development lab to pass profiles directly. `simulate()` stays unchanged. Future leaf growth uses its continuous height ratio to avoid the rounded leafCount's topology pops. Rendering is capped at 160 blades, 12 stems, 32 ribs and 6 offsets.
