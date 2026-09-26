// Shared contract between server, web and mobile.
//
//   PlantIdentity           which species this is (from the photo)
//   PlantObservation        what THIS plant looks like in the photo, today
//   SpeciesMorphologyPrior  how the species is built (from curated/live references), for rendering
//   SpeciesStage            how the species changes over its life, relative to maturity
//   GrowthStageReference    those stages personalised to this plant (today first, then the future)
//   PlantProfile            everything above plus wiki/care: the app-facing contract
//   PlantState              simulate(profile, month, waterIntervalDays): the plant at a moment
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/).describe("Hex color like #3a7d44");
const unit = (what = "0 to 1") => z.number().min(0).max(1).describe(what);
const range = z.object({ min: z.number().min(0), max: z.number().min(0) });

export const Archetype = z.enum(["aroid", "cane", "herb", "shrub", "succulent", "cactus", "vine", "grass", "tree"])
  .describe("Renderer family by visual architecture: aroid = Monstera/Philodendron-like leaves on long petioles from a crown; cane = Dracaena/Yucca-like woody canes topped by leaf rosettes; herb = soft branching stems (basil, mint); shrub = woody branching; succulent = leafy rosette (Echeveria, Aloe); cactus = leafless ribbed body; vine = trailing/climbing; grass = strap leaves from the base (also snake plant, spider plant); tree = woody trunk with a branched canopy (Ficus)");
export type Archetype = z.infer<typeof Archetype>;

export const GrowthStage = z.enum(["SEEDLING", "JUVENILE", "YOUNG", "MATURE", "LARGE_MATURE"]);
export type GrowthStage = z.infer<typeof GrowthStage>;
export const STAGES = GrowthStage.options;

// ---- 1. Identity -------------------------------------------------------------------------------

export const PlantIdentity = z.object({
  commonName: z.string(),
  scientificName: z.string().describe("Binomial, e.g. 'Monstera deliciosa'"),
  family: z.string(),
  confidence: unit("Honest certainty in the identification"),
  aliases: z.array(z.string()).max(5).describe("Other common names or synonyms"),
});
export type PlantIdentity = z.infer<typeof PlantIdentity>;

export const PlantWiki = z.object({
  nativeRegion: z.string(),
  summary: z.string().describe("2-3 sentence encyclopedia-style introduction"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  toxicToPets: z.boolean(),
});

export const PlantCare = z.object({
  waterIntervalDays: z.number().positive(),
  light: z.enum(["low", "medium", "bright-indirect", "full-sun"]),
  humidity: z.enum(["low", "medium", "high"]),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  soil: z.string(),
});
export type PlantCare = z.infer<typeof PlantCare>;

// ---- 2. Observation: this plant, as photographed today ---------------------------------------

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

// ---- 3. Species morphology prior ----------------------------------------------------------------

/** How the species is built, for rendering. Comes from the curated library or normalised references. */
export const SpeciesMorphologyPrior = z.object({
  archetype: Archetype,
  growthHabit: z.enum(["upright", "bushy", "rosette", "climbing", "trailing", "columnar", "clumping", "tree"]),
  branchingPattern: z.enum(["none", "basal-clump", "monopodial", "sympodial", "opposite-pairs", "offsets"]).describe("none = one unbranched axis/crown; basal-clump = new shoots from the base; offsets = pups (cacti, succulents)"),
  leafArrangement: z.enum(["alternate", "opposite", "whorled", "rosette", "basal", "none"]),
  leafShape: z.enum(["ovate", "cordate", "lanceolate", "strap", "palmate", "needle", "round", "fenestrated"]),
  leafLengthCm: z.object({ juvenile: range, mature: range }),
  leafWidthToLength: z.number().min(0.02).max(3),
  stem: z.object({
    structure: z.enum(["crown", "herbaceous", "semi-woody", "woody", "cane", "succulent-body"]),
    matureThicknessMm: z.number().positive(),
  }),
  petiole: z.object({ present: z.boolean(), lengthToBlade: z.number().min(0).max(4).describe("Petiole length / blade length on mature leaves") }),
  canopyForm: z.enum(["dome", "vase", "column", "spreading", "rosette", "cascading", "globe"]),
  canopyWidthToHeight: z.number().min(0.1).max(5).describe("Typical mature canopy width / height"),
  roots: z.object({ type: z.enum(["taproot", "fibrous", "rhizome", "tuberous", "aerial"]), maxDepthCm: z.number().positive(), maxSpreadCm: z.number().positive() }),
  matureHeightCm: z.number().positive().describe("Typical mature height grown indoors"),
  monthsToMaturity: z.number().positive().describe("Indoors, from a young plant to mature form"),
  fenestrationMature: unit("Split/hole share on mature leaves (0 for most species)"),
  juvenileVsMature: z.string().describe("How juvenile and adult plants differ visibly"),
  notes: z.array(z.string()).max(6).describe("Rendering-relevant traits (leaf posture, surface, stem marks...)"),
});
export type SpeciesMorphologyPrior = z.infer<typeof SpeciesMorphologyPrior>;

/** One life stage of the SPECIES, relative to its maturity (age and height as fractions). */
export const SpeciesStage = z.object({
  stage: GrowthStage,
  relativeAge: unit("Fraction of monthsToMaturity"),
  relativeHeight: unit("Height / matureHeightCm"),
  canopyWidthToHeight: z.number().min(0.1).max(5),
  leafCount: range.describe("Leaves typically kept at this stage"),
  leafMaturity: unit("0 juvenile leaf form, 1 adult leaf form"),
  fenestration: unit(),
  axes: z.number().min(1).max(40).describe("Stems/canes/crowns/offsets"),
  branchDensity: unit("0 unbranched, 1 densely branched"),
  morphologicalNotes: z.array(z.string()).max(4),
});
export type SpeciesStage = z.infer<typeof SpeciesStage>;

export const KnowledgeSource = z.object({
  provider: z.enum(["library", "wikipedia", "wikimedia-commons", "claude", "generic"]),
  title: z.string(),
  url: z.string().optional(),
  license: z.string().optional(),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSource>;

/** What the enrichment pipeline knows about a species (cached per scientific name). */
export const SpeciesKnowledge = z.object({
  scientificName: z.string(),
  prior: SpeciesMorphologyPrior,
  stages: z.array(SpeciesStage).min(2).max(6),
  sources: z.array(KnowledgeSource),
});
export type SpeciesKnowledge = z.infer<typeof SpeciesKnowledge>;

// ---- 4. Growth stage references, personalised ---------------------------------------------------

/** A species stage mapped onto THIS plant: stage 0 is today (the observation), later ones are its future. */
export const GrowthStageReference = z.object({
  stage: GrowthStage,
  relativeAge: unit(),
  monthsFromNow: z.number().min(0),
  relativeHeight: unit(),
  heightCm: z.number().positive(),
  canopyWidthCm: z.number().positive(),
  expectedLeafCount: range,
  leafCount: z.number().min(0).describe("Target count for this plant (its own density, not the species average)"),
  leafLengthCm: z.number().min(0),
  leafMaturity: unit(),
  fenestration: unit(),
  axes: z.number().min(1).max(40),
  branchDensity: unit(),
  stemThicknessMm: z.number().positive(),
  morphologicalNotes: z.array(z.string()).max(4),
  confidence: unit(),
  source: z.enum(["observation", "library", "reference", "generic"]),
});
export type GrowthStageReference = z.infer<typeof GrowthStageReference>;

// ---- 5. The profile -----------------------------------------------------------------------------

/** What Claude reads from the photo: identity, the visible plant, and the care/wiki card. */
export const PlantIdentification = z.object({
  identity: PlantIdentity,
  observation: PlantObservation,
  wiki: PlantWiki,
  care: PlantCare,
  facts: z.array(z.string()).min(3).max(5),
});
export type PlantIdentification = z.infer<typeof PlantIdentification>;

/** The app-facing contract: the identification enriched with species knowledge and personalised stages. */
export const PlantProfile = PlantIdentification.extend({
  prior: SpeciesMorphologyPrior,
  stages: z.array(GrowthStageReference).min(2).max(7).describe("stages[0] is today"),
  sources: z.array(KnowledgeSource),
});
export type PlantProfile = z.infer<typeof PlantProfile>;

// ---- 6. State -----------------------------------------------------------------------------------

/** Growing conditions a what-if can change. */
export const GrowthConditions = z.object({
  waterIntervalDays: z.number().positive(),
  light: z.enum(["low", "medium", "bright-indirect", "full-sun"]),
  potDiameterCm: z.number().positive().describe("Repotting changes this"),
  pace: z.number().min(0.1).max(3).describe("Other care (feeding, humidity, warmth) as a growth-rate multiplier, 1 = typical"),
});
export type GrowthConditions = z.infer<typeof GrowthConditions>;

/** Output of simulate(): the plant's morphology at a moment. Pure and deterministic. */
export const PlantState = z.object({
  stage: GrowthStage,
  stageIndex: z.number().min(0).describe("Continuous position between stages[i] and stages[i+1]"),
  heightCm: z.number().nonnegative(),
  canopyWidthCm: z.number().nonnegative(),
  leafCount: z.number().int().nonnegative(),
  leaves: z.number().nonnegative().describe("Continuous leaf count, so new leaves emerge gradually"),
  leafLengthCm: z.number().nonnegative(),
  leafMaturity: unit(),
  fenestration: unit(),
  axes: z.number().min(1),
  branchingDensity: unit(),
  stemThicknessMm: z.number().nonnegative(),
  rootMass: unit("Share of the pot volume filled by roots"),
  rootDepthCm: z.number().nonnegative(),
  rootSpreadCm: z.number().nonnegative(),
  hydration: unit(),
  wilt: unit(),
  droop: unit("Structural droop from wilt and weight"),
  vitality: unit("0 dying, 1 thriving: colour and vigour"),
  effectiveMonths: z.number().nonnegative().describe("Months of healthy growth achieved (slower under stress)"),
  changes: z.array(z.string()).describe("Morphological changes of the stage being approached"),
});
export type PlantState = z.infer<typeof PlantState>;

// ---- Persistence ----

/** A scanned plant kept in a user's collection (web: localStorage). */
export const SavedPlant = z.object({
  id: z.string().min(1).describe("Stable id for this saved instance, independent of species"),
  profile: PlantProfile,
  photoThumb: z.string().optional().describe("Small JPEG data URL of the scanned photo"),
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
  profile: PlantProfile,
});

/**
 * Refine may only adjust what the render gets visibly wrong about TODAY's plant. Every field is
 * optional; absent means "keep". The species card, prior and growth path are never rewritten: the
 * stages are re-personalised from the patched observation on the server.
 */
export const RefinePatch = z.object({
  frame: PlantObservation.shape.frame.partial().optional(),
  pot: PlantObservation.shape.pot.partial().optional(),
  structure: z.object({
    axes: PlantObservation.shape.structure.shape.axes.optional(),
    leafClusters: PlantObservation.shape.structure.shape.leafClusters.optional(),
    branching: unit().optional(),
  }).optional(),
  leaves: PlantObservation.shape.leaves.pick({ count: true, density: true, lengthCmMin: true, lengthCmMax: true, widthToLength: true, orientation: true, fenestration: true, gloss: true }).partial().optional(),
  colors: PlantObservation.shape.colors.partial().optional(),
  maturity: unit().optional(),
  stage: GrowthStage.optional(),
  corrections: z.array(z.string()).min(1).max(8).describe("What was visibly off and how it was fixed, short phrases"),
});
export type RefinePatch = z.infer<typeof RefinePatch>;

export const RefineResult = z.object({ profile: PlantProfile, corrections: z.array(z.string()), changed: z.array(z.string()) });
export type RefineResult = z.infer<typeof RefineResult>;

export const WhatIfRequest = z.object({
  profile: PlantProfile,
  conditions: GrowthConditions,
  question: z.string().min(1).max(500),
});

/** What Claude decides for a scenario: new conditions in simulation terms, and why. */
export const WhatIfAnswer = z.object({
  conditions: GrowthConditions,
  explanation: z.string().describe("2-3 friendly sentences on what would happen to THIS plant and why"),
});

/** The scenario plus the simulated plant a year out, so the app shows exactly what it explains. */
export const WhatIfResponse = WhatIfAnswer.extend({
  inAYear: PlantState,
  baseline: PlantState,
});
export type WhatIfResponse = z.infer<typeof WhatIfResponse>;
