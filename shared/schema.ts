// Shared contract between server and web. Announce any change here to the whole team.
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/).describe("Hex color like #3a7d44");

const unit = (what = "0 to 1") => z.number().min(0).max(1).describe(what);

// ---- A. Species knowledge -------------------------------------------------------------------
// PlantProfile (below) is what is true of the SPECIES: identity, wiki, care, typical morphology
// and roots. It never describes the photographed individual; PlantObservation does.

export const Archetype = z.enum(["aroid", "cane", "herb", "shrub", "succulent", "cactus", "vine", "grass", "tree"])
  .describe("Renderer family by visual architecture: aroid = Monstera/Philodendron-like leaves on long petioles from a crown; cane = Dracaena/Yucca-like woody canes topped by leaf rosettes; herb = soft branching stems (basil, mint); shrub = woody branching; succulent = leafy rosette (Echeveria, Aloe); cactus = leafless ribbed body; vine = trailing/climbing; grass = strap leaves from the base; tree = single trunk with a canopy");
export type Archetype = z.infer<typeof Archetype>;

export const GrowthStage = z.enum(["SEEDLING", "JUVENILE", "YOUNG", "MATURE", "LARGE_MATURE"]);
export type GrowthStage = z.infer<typeof GrowthStage>;

// ---- B. This plant, as photographed today -----------------------------------------------------

const direction = z.enum(["center", "left", "right", "toward", "away"]).describe("Relative to the camera");

/**
 * What Claude sees in THIS photo of THIS plant. The "Scanned plant" render is built from it, so it
 * describes the individual (count what you see, measure against the pot), never a species average.
 */
export const PlantObservation = z.object({
  archetype: Archetype,
  frame: z.object({
    plantHeightCm: z.number().positive().describe("From the soil surface to the highest leaf"),
    canopyWidthCm: z.number().positive().describe("Widest horizontal extent of the foliage as seen in the photo"),
    leanDeg: z.number().min(0).max(60),
    leanDirection: direction,
    symmetry: unit("0 very lopsided, 1 perfectly symmetric"),
  }),
  pot: z.object({
    visible: z.boolean(),
    shape: z.enum(["nursery", "tapered", "cylinder", "bowl"]).describe("nursery = thin plastic grower pot with a rolled rim"),
    material: z.enum(["terracotta", "ceramic", "plastic", "concrete"]),
    color: hexColor,
    rimDiameterCm: z.number().min(2).max(200),
    heightCm: z.number().min(2).max(200),
  }),
  structure: z.object({
    axes: z.array(z.object({
      kind: z.enum(["stem", "cane", "trunk", "crown"]).describe("crown = a basal growing point with leaves on petioles (aroids, grasses, rosettes)"),
      heightCm: z.number().min(0).describe("How high this axis rises above the soil (0 for a crown at soil level)"),
      thicknessMm: z.number().min(0.5).max(400),
      leanDeg: z.number().min(0).max(90),
      direction,
    })).min(1).max(12).describe("Each separate stem, cane, trunk or crown coming out of the soil, largest first"),
    leafClusters: z.array(z.object({
      height: unit("Cluster centre height as a fraction of plant height"),
      direction,
      share: unit("Fraction of all leaves in this cluster"),
    })).min(1).max(8).describe("Where the foliage mass sits, e.g. a top rosette on each cane, or one dome"),
    branching: unit("0 no side branches, 1 densely branched"),
  }),
  leaves: z.object({
    count: z.number().int().min(0).describe("Leaves you can count or reasonably estimate in the photo"),
    density: unit("0 sparse and see-through, 1 dense and opaque canopy"),
    lengthCmMin: z.number().min(0),
    lengthCmMax: z.number().min(0),
    widthToLength: z.number().min(0.02).max(3),
    shape: z.enum(["ovate", "cordate", "lanceolate", "strap", "palmate", "needle", "round", "fenestrated"]),
    arrangement: z.enum(["alternate", "opposite", "whorled", "rosette", "basal"]),
    orientation: z.enum(["upright", "spreading", "arching", "drooping"]),
    tip: z.enum(["acute", "acuminate", "rounded", "notched"]),
    edge: z.enum(["smooth", "serrated", "lobed", "wavy"]),
    fenestration: unit("Share of the blade taken by splits/holes on the visible leaves"),
    gloss: unit("0 matte, 1 glossy"),
    variegation: z.enum(["none", "streaks", "patches", "margin", "speckled"]),
  }),
  colors: z.object({
    leaf: hexColor.describe("Typical lit leaf colour (sampled, not highlight or shadow)"),
    leafYoung: hexColor.describe("Newest leaves (often lighter)"),
    underside: hexColor,
    stem: hexColor,
    variegation: hexColor,
    soil: hexColor,
  }),
  succulent: z.object({
    bodyForm: z.enum(["none", "globe", "column", "pads", "rosette"]),
    ribCount: z.number().int().min(0).max(60),
    spineDensity: unit("0 no spines, 1 densely covered"),
    spineColor: hexColor,
    offsets: z.number().int().min(0).max(40),
  }),
  health: z.object({
    vigor: unit("0 dying, 1 thriving"),
    wilt: unit("0 turgid, 1 collapsed"),
    yellowing: unit("Share of leaf area yellowed"),
    brownTips: unit("Share of leaves with dry brown tips or edges"),
    pests: z.boolean(),
    notes: z.string().describe("What is visible: yellowing, pests, dry tips, leggy growth, or 'looks healthy'"),
  }),
  maturity: unit("0 seedling/cutting, 1 fully mature for the species"),
  stage: GrowthStage,
  confidence: z.object({
    structure: unit("How sure you are of counts and layout"),
    size: unit("How sure you are of absolute sizes (1 only with a clear scale reference)"),
  }),
});
export type PlantObservation = z.infer<typeof PlantObservation>;

// ---- D. How this plant could develop ------------------------------------------------------------

/** One stage on the plant's likely path, anchored on today's observation, grounded in species priors. */
export const GrowthStagePlan = z.object({
  stage: GrowthStage,
  monthsFromNow: z.number().min(0).describe("0 for the current stage"),
  heightCm: z.number().positive(),
  canopyWidthCm: z.number().positive(),
  leafCount: z.number().int().min(0),
  leafLengthCm: z.number().min(0).describe("Typical newest-leaf length at this stage"),
  maturity: unit("Leaf-form / structural maturity at this stage"),
  axes: z.number().int().min(1).max(20).describe("Stems/canes/crowns at this stage"),
  fenestration: unit("Split/hole share on new leaves (aroids), 0 otherwise"),
  changes: z.array(z.string()).max(4).describe("Visible structural changes on the way to this stage, short phrases"),
  confidence: unit(),
});
export type GrowthStagePlan = z.infer<typeof GrowthStagePlan>;

export const GrowthPlan = z.object({
  habit: z.enum(["upright", "bushy", "rosette", "climbing", "trailing", "columnar", "clumping"]),
  stages: z.array(GrowthStagePlan).min(2).max(6).describe("Today's stage first (monthsFromNow 0, matching the observation), then likely future stages in order"),
  source: z.enum(["claude", "reference", "mock"]).describe("Where the stages came from"),
});
export type GrowthPlan = z.infer<typeof GrowthPlan>;

export const PlantProfile = z.object({
  species: z.object({
    commonName: z.string(),
    scientificName: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  wiki: z.object({
    family: z.string(),
    nativeRegion: z.string(),
    summary: z.string().describe("2-3 sentence encyclopedia-style introduction"),
    difficulty: z.enum(["easy", "medium", "hard"]),
    toxicToPets: z.boolean(),
  }),
  morphology: z.object({
    growthForm: z.enum(["rosette", "upright-branching", "vine", "succulent", "tree", "grass"]),
    currentHeightCm: z.number().positive(),
    matureHeightCm: z.number().positive(),
    stemColor: hexColor,
    branchingAngleDeg: z.number().min(0).max(90),
    branchingDepth: z.number().int().min(1).max(5),
    leaf: z.object({
      shape: z.enum(["ovate", "lanceolate", "palmate", "needle", "round", "fenestrated"]),
      color: hexColor,
      lengthCm: z.number().positive(),
      countNow: z.number().int().min(0),
    }),
  }),
  growth: z.object({
    rateCmPerMonth: z.number().min(0),
    monthsToMaturity: z.number().positive(),
  }),
  roots: z.object({
    type: z.enum(["taproot", "fibrous", "rhizome", "tuberous", "aerial"]),
    maxDepthCm: z.number().positive(),
    maxSpreadCm: z.number().positive(),
  }),
  care: z.object({
    waterIntervalDays: z.number().positive(),
    light: z.enum(["low", "medium", "bright-indirect", "full-sun"]),
    humidity: z.enum(["low", "medium", "high"]),
    tempMinC: z.number(),
    tempMaxC: z.number(),
    soil: z.string(),
  }),
  facts: z.array(z.string()).min(3).max(5),
  healthNotes: z.string().describe("Species-level health advice; what THIS plant shows goes in observation.health"),
});
export type PlantProfile = z.infer<typeof PlantProfile>;

// ---- The scan: everything the app knows about one photographed plant ---------------------------

/** A = species knowledge, B = this plant today, D = its likely future. C (the render plan) is derived client-side. */
export const PlantScan = z.object({
  profile: PlantProfile,
  observation: PlantObservation,
  growth: GrowthPlan,
});
export type PlantScan = z.infer<typeof PlantScan>;

/** Future-mode conditions a what-if can change. */
export const GrowthConditions = z.object({
  waterIntervalDays: z.number().positive(),
  light: z.enum(["low", "medium", "bright-indirect", "full-sun"]),
  potDiameterCm: z.number().positive().describe("Repotting changes this"),
});
export type GrowthConditions = z.infer<typeof GrowthConditions>;

/** Output of simulate(): a snapshot of growth/soil/watering state at a point in time. */
export const PlantState = z.object({
  heightCm: z.number().nonnegative(),
  leafCount: z.number().int().nonnegative(),
  rootDepthCm: z.number().nonnegative(),
  rootSpreadCm: z.number().nonnegative(),
  hydration: z.number().min(0).max(1),
  wilt: z.number().min(0).max(1),
});
export type PlantState = z.infer<typeof PlantState>;

// ---- Persistence ----

/** A scanned plant kept in a user's collection (today: web/src/myPlants.ts, localStorage). */
export const SavedPlant = z.object({
  id: z.string().min(1).describe("Stable id for this saved instance, independent of species"),
  scan: PlantScan,
  photoThumb: z.string().optional().describe("Small JPEG data URL of the scanned photo, for the Scanned view"),
  lastWateredAt: z.number().int().nonnegative().describe("Unix ms timestamp"),
});
export type SavedPlant = z.infer<typeof SavedPlant>;

// ---- API payloads ----

export const ImageInput = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});
export type ImageInput = z.infer<typeof ImageInput>;

export const AnalyzeRequest = ImageInput;

export const RefineRequest = z.object({
  photo: ImageInput,
  renderScreenshot: ImageInput,
  scan: PlantScan,
});

/** Refine corrects the reconstruction of today's plant (and its stage), never the species card. */
export const RefineResponse = z.object({
  observation: PlantObservation,
  growth: GrowthPlan,
  corrections: z.array(z.string()).max(8).describe("What was visibly off in the render and how it was fixed, short phrases"),
});
export type RefineResponse = z.infer<typeof RefineResponse>;

/** What /api/refine returns to the app: the scan with its reconstruction corrected, and what changed. */
export const RefineResult = z.object({ scan: PlantScan, corrections: z.array(z.string()) });
export type RefineResult = z.infer<typeof RefineResult>;

export const WhatIfRequest = z.object({
  scan: PlantScan,
  conditions: GrowthConditions,
  question: z.string().min(1).max(500),
});

/** A what-if changes the future, not today: new conditions, a re-planned growth path, and why. */
export const WhatIfResponse = z.object({
  conditions: GrowthConditions,
  growth: GrowthPlan,
  vigor: unit("Expected vigor under the scenario"),
  explanation: z.string(),
});
export type WhatIfResponse = z.infer<typeof WhatIfResponse>;
