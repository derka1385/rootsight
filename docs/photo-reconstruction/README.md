# Photo-faithful reconstruction

Goal: a stylized 3D plant the owner recognises as **their** plant (same silhouette, fullness, flowers), not a generic plant of the species.

## Why the render did not match the photo

1. **Mock mode.** With `USE_MOCK=true` every photo returns the hand-authored `observedMonstera` in about 0.6 s, whatever was uploaded.
2. **Live mode could not run.** `temperature: 0` is rejected by current models, and the full vision schema is too large for strict structured outputs.
3. **No place for flowers.** The vision contract had no field for flowers, buds or fruits, so they could not reach the renderer.
4. **Density did not add foliage.** The render drew `leaf.countNow` blades. Claude undercounts bushy plants, and `crownDensity` only changed the spread.
5. **Generic placement.** At most 32 observed blades kept their photo positions. Every other leaf followed a golden-angle pattern around generated stems.
6. **Roots by default.** The main viewer opened on a cut-away pot with roots.

## Pipeline now

```
photo -> visual inventory (Claude, high effort) -> IndividualPlantProfile + species.flowering
      -> species presets fill what the photo cannot show -> stylized 3D (leaves, stems, flowers)
```

- `server/src/claude.ts`: the JSON Schema goes in the prompt and zod validates the answer (one retry with the error, then 502). No sampling parameters. The call streams.
- `server/src/prompts.ts`: the model inventories before it describes. It counts leaves, flowers, buds, fruits and stems, then gives silhouette and fullness, then structure, then blooms, then species flower structure. Visible organs are never dropped, and none are invented.
- `shared/morphology.ts` (**IndividualPlantProfile**, this plant) now carries:
  - `occupancy`: an 8×8 foliage silhouette.
  - `stems`: the observed leafy stems.
  - `blooms`: counts, sampled colours, flower size, placement, stalk length, and up to 24 flower/bud/fruit landmarks with position, depth layer, facing and floret count.
  - Extended `crownShape` values.
- `shared/species-profile.ts` (**SpeciesProfile**, the species) now carries `flowering`: form, petals, petal shape, inflorescence, typical colours and fruit, taken from `species.flowering` returned by Claude. Rosettes such as cyclamen or African violet get their own preset instead of Monstera's holes.

All new fields are optional in `PlantProfile` (saved plants still load) and required in `VisionPlantProfile`.

## Renderer

- **Density floor** (`densityLeafFloor`). The leaf count is raised to what the photographed foliage area needs to look as opaque as its observed density. Legacy profiles keep their own count.
- **Silhouette fill** (`sampleFoliage`, `canopyNormal`). Leaves that are not individually observed are placed in occupied cells of the photo silhouette. Each lies tangent to the canopy dome with its top face out and follows the observed leaf angle. Observed blades keep their photo positions and show their top face to the camera.
- **Observed stems.** Leafy stems end where the photo shows their leaves end. Flower stalks belong to the blooms.
- **Frame at the pot rim.** A photo shows the plant starting at the rim, not the hidden soil.
- **Flower generator.**
  - `bloomLayout.ts`: every counted flower, bud and fruit is drawn. Landmarks sit where the photo puts them. Extra heads are spread where the species carries them. Clusters open into domes or spikes of florets, with peduncles and pedicels.
  - `Flowers.tsx`: instanced petals fanned at the opening angle of the species' flower form (11 forms), blending into the photographed centre colour. Also buds, fruits and spadices. Heads nod under drought.
- **Roots are opt-in.** The main view shows an intact pot. "Show roots (cut-away pot)" in the plant screen opens it.

## Visual pass (same geometry, better rendering)

The layout is untouched: the same organs sit in the same places. What changed is how they are drawn.

- **Stems** (`StemGeometry.ts`): each stem is a spline that tapers progressively. Main stems have a flared base. The section is slightly oval and turns along the stem, with a gentle low-frequency swell. Vertex colours make main stems woody and darker at the base and petioles fresher. A fibre detail map finishes the surface.
- **Leaves** (`leafBlade.ts`, `leafSurface.ts`, `Plant.tsx`):
  - **Shape:** the blade arches, the margins form a shallow gutter, and a midrib groove and light quilting run between the veins.
  - **Material:** a physical material with a waxy clearcoat on glossy leaves and a faint sheen on matte ones. A shared vein normal map adds relief.
  - **Light:** thin-tissue shading lets backlit blades glow (`shading.ts`).
  - **Variation:** four blade variants and a per-leaf tint, so no two neighbouring leaves are identical.
- **Flowers** (`Flowers.tsx`): smooth 18×12 petals with a narrow claw, rounded or pointed tip, cup and curl per form. The velvety material has sheen and backlit translucency, fine veins, a paler margin and back, and blends into the photographed centre colour. Buds are smoother.
- **Scene** (`Interior.tsx`, replaces the old flat lighting file):
  - an oak table against a limewashed wall;
  - a wood-framed window to the right of the plant;
  - late-afternoon sun through that window, with soft PCSS shadows;
  - warm bounce fill and environment reflections, contact shadow and half-resolution GTAO;
  - ACES Filmic tone mapping and sRGB output;
  - a lower camera.
- Everything is procedural, with no downloads. The cyclamen view draws about 86 calls, AO pre-pass included.

## Refinement pass

- **Attached blooms.** Every flower, bud and fruit has a `base` where its stalk ends: behind the petals, at the back of a bud, at the top of a fruit. Stalks end exactly there and enter along the organ's axis. A calyx cone joins stalk and petals, so there are no floating heads. `verify.ts` asserts it.
- **Structured flowers.** Petals are evenly spaced with little jitter and a shared twist (stronger on swept-back forms). Photographed blooms face the camera side as in the photo, so they never face the wall.
- **Stems.** Deeper and matte, with darker fibres and fewer environment glints, and a softer blend toward the tip colour. They never read pale or white.
- **Inspection.**
  - Orbit goes all the way around, from table level to overhead, with inertia.
  - Zoom goes toward the cursor.
  - The pivot sits a little above the middle of the plant.
  - The wall and window hide themselves when the camera passes behind them.

## Grounding pass

Flowers are anchored by geometry, shadow and light. Otherwise they look pasted onto the plant.

- **Geometry.**
  - The calyx is a truncated cone as thick as the stalk where they meet, so there is no pinch.
  - On stemmed plants, flower stalks grow out of the nearest photographed stem top (or the plant's core), never from mid-air.
- **Shadow.**
  - The sun's shadow frustum is fitted to the plant, giving sub-millimetre texels. `normalBias` went from 2 cm to 2 mm; 2 cm was larger than a petal and erased every local shadow.
  - Tighter PCSS penumbrae and stronger GTAO add to it.
- **Occlusion.** Petals darken where they crowd into the calyx, and stalks darken where they leave their parent and under the head they carry.
- **Coherent light.** Petals use the leaves' thin-tissue shading, with less sheen and environment light, so a flower no longer glows apart from its plant.

## Flower morphology (trumpets)

A diameter plus a species form ("trumpet") could not describe a long trumpet, and "trumpet" was drawn as five loose petals fanned from a point. Now:

- **Analysis:** `individual.blooms.flowerShape` is measured on the photo. It holds the length along the axis, the fused-tube fraction, the tube diameter, the flare, the rim lobes, the calyx length and the axis angle. Claude must fill it. It is optional in saved profiles.
- **Generation:** a flower with a real tube (`tubeFraction` ≥ 0.2, or a trumpet, tubular or bell form) is one continuous corolla.
  - The tube widens into the measured mouth.
  - The rim has pointed lobes and a rolled edge.
  - A green calyx sheath covers the base, and the stalk joins the base of the tube.
  - Buds are spindles of the measured length.
- **Fixture:** `brugmansia` is a live scan of a CC photo ([Brugmansia suaveolens, Yercaud](https://commons.wikimedia.org/wiki/File:Brugmansia_suaveolens-yercaud-salem-India.jpg), CC BY-SA 4.0). It measured 28 cm long, 60 % tube, a 2.5 cm tube, 5 lobes, a 10 cm calyx, hanging at 160°.

## Detailed corollas (Datura 'Double Purple')

A scanned Datura 'Double Purple' came out as a smooth funnel on a pipe, with cone buds and smooth green balls. The outline measurements (length, tube, flare, lobes) were right, but nothing described what makes that flower recognisable. Now:

- **Analysis:** `flowerShape` also reads:
  - `layers`: nested corollas (hose-in-hose);
  - `tipTail`: lobe tips drawn into curling tails;
  - `ribs`: a pleated, striped tube;
  - `innerColor`: the throat.
  `blooms.fruitSurface` reads the fruit's skin (spiny for thorn-apples). Claude must fill all of them; they are optional in saved profiles, where plain-trumpet defaults apply.
- **Corolla** (`corollaModel`):
  - The tube is plicate: every lobe's midrib runs down it as a ridge, with a fold between ridges that deepens toward the mouth, and fine ribs.
  - The rim is scalloped, one broad lobe per midrib rising to a small point. Between the points it ruffles and rolls outward.
  - The front face is the outside. The shader paints a pale base with the flower colour running up in veins, and paler lines between the veins of a ribbed tube. Inside, the throat takes the inner colour and the limb shows the flower colour.
- **Nested corollas:** each inner corolla is 20 % narrower in the tube (so it never comes through the one around it; `verify.ts` checks every angle), rises 15 % further, opens a little wider, and is turned half a lobe.
- **Tails:** a tapered strand leaves every lobe point along the lobe and curls outward and back.
- **Calyx:** a pale, five-angled tube with a rounded base on the stalk and pointed teeth.
- **Buds:** furled spindles with twisted pleats and a pointed tip, the lower part in the calyx.
- **Fruits:** capsules set with 72 stout spines when `fruitSurface` is spiny.
- **Fixture:** `datura` is a live scan of a CC photo ([Datura metel 'Fastuosa' bud and flower](https://commons.wikimedia.org/wiki/File:Datura_metel_%27Fastuosa%27_bud_and_flower.jpg), CC BY-SA 4.0). It read 3 layers, tails 0.85, ribs 0.85, a cream throat and spiny fruit.

| Close-up (lab, lowered camera) | Whole plant |
| --- | --- |
| ![datura close-up](datura-close.png) | ![datura](datura-scan.png) |

## Grown stems (stylized botanical)

- **Curves.** Stems, branches and petioles are cubic Bézier centrelines, not polylines. The same curve places the leaves and branches, so the old straight-line attachments that no longer matched the drawn stem are gone.
  - Main stems leave the soil upright, bow gently by the photographed curvature, and turn up at the tip.
  - Branches leave outward and curve up.
  - Petioles rise, arch, and arrive along their blade's axis.
- **Thickness hierarchy.**
  - Stems are 1.35× the measured thickness, never below 0.45 % of plant height.
  - A branch starts at 72 % of its parent's radius at that point.
  - Twigs thicken with their length.
  - Flower stalks are sized to what they carry.
  - A smoother taper (t^1.6) and soft collars at every junction complete it.
- **Material.** Stems use the same family as leaves and petals: matte with a soft sheen.

## Run it live

```sh
# server/.env: ANTHROPIC_API_KEY=..., USE_MOCK=false, ANTHROPIC_MODEL=claude-opus-5-5 (or claude-sonnet-5)
npm run dev -w server                       # or PORT=8791 to run next to another checkout
API_PORT=8791 npm run dev -w web -- --port 5191
```

One analysis took 36 to 55 s with Opus 5.5 at high effort, on the first validation attempt each time. The sample plants **Florist's cyclamen** and **Flaming Katy** in Explore (and in the fidelity lab as `?profile=cyclamen|kalanchoe`) are real live scans of the photos below.

## Verify

```sh
npm run typecheck && npm run build
node --import tsx docs/fidelity/verify.ts
node --import tsx docs/photo-reconstruction/verify.ts
USE_MOCK=true PORT=8792 npx tsx server/src/index.ts &   # from server/
VERIFY_API=http://localhost:8792 node --import tsx docs/individual-morphology/verify.ts
```

`photo-reconstruction/verify.ts` checks that:
- counted flowers, buds and fruits are drawn exactly, never invented;
- petals per flower follow the species;
- blooms are deterministic;
- the density floor applies;
- fill leaves stay inside the photographed foliage;
- blades stay continuous across a leaf birth.

## Evidence

| Scan (default camera) | Source photo |
| --- | --- |
| ![cyclamen](cyclamen-scan.png) | [Pot cyclamen 048](https://commons.wikimedia.org/wiki/File:Pot_cyclamen_048.JPG), Penarc, CC BY 3.0 |
| ![kalanchoe](kalanchoe-scan.png) | [Flaming Katy in a ceramic pot](https://commons.wikimedia.org/wiki/File:Flaming_Katy_in_a_ceramic_pot.jpg), Slyronit, CC BY-SA 4.0 |

The photos are not in the repo.

## Limits

- The occupancy grid is coarse (8×8) and Claude's estimate. Hidden depth and the back of the plant are inferred.
- Flowers use 11 stylized forms plus a measured fused corolla, not per-species petal outlines. Calyx speckles and lobe asymmetry are not modelled. Pot shape (for example a bellied jar) is not modelled, only proportions and colour.
- Mock mode still returns the same hand-authored monstera for any photo. Only live mode reflects the uploaded plant.
