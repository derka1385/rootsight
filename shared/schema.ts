// Shared contract between server and web. Announce any change here to the whole team.
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/).describe("Hex color like #3a7d44");

const unit = (what: string) => z.number().min(0).max(1).describe(what);

/**
 * What THIS specimen looks like in the photo (not the species average), for the 3D renderer.
 * Optional on PlantProfile so older saved plants still load; Claude is always asked to fill it.
 */
export const PlantVisual = z.object({
  silhouette: z.object({
    widthToHeight: z.number().min(0.1).max(5).describe("Canopy width / plant height as seen in the photo"),
    leanDeg: z.number().min(0).max(60).describe("How far the main stem leans from vertical"),
    leanDirection: z.enum(["none", "left", "right", "toward", "away"]).describe("Lean direction relative to the camera"),
    symmetry: unit("0 = very lopsided, 1 = perfectly symmetric"),
    legginess: unit("0 = compact and bushy, 1 = long bare stems stretching for light"),
  }),
  stems: z.object({
    countFromSoil: z.number().int().min(1).max(60).describe("Separate stems/crowns emerging from the soil"),
    thicknessMm: z.number().min(0.5).max(300).describe("Main stem or petiole diameter"),
    internodeCm: z.number().min(0.1).max(60).describe("Typical distance between leaves along a stem"),
  }),
  leaves: z.object({
    arrangement: z.enum(["alternate", "opposite", "whorled", "rosette", "basal"]),
    widthToLength: z.number().min(0.02).max(3).describe("Leaf blade width / length"),
    tip: z.enum(["acute", "acuminate", "rounded", "notched"]),
    edge: z.enum(["smooth", "serrated", "lobed", "wavy"]),
    fenestration: unit("Share of the blade taken by splits/holes: 0 none, 1 heavily fenestrated"),
    variegation: z.enum(["none", "streaks", "patches", "margin", "speckled"]),
    variegationColor: hexColor,
    gloss: unit("0 matte, 1 glossy"),
    colorUnder: hexColor.describe("Leaf underside colour, sampled if visible, else estimated"),
    droop: unit("0 leaves held up, 1 leaves hanging down"),
    sizeVariation: unit("0 all leaves the same size, 1 tiny new leaves next to huge old ones"),
  }),
  succulent: z.object({
    bodyForm: z.enum(["none", "globe", "column", "pads", "rosette"]).describe("none for non-succulents"),
    ribCount: z.number().int().min(0).max(60),
    spineDensity: unit("0 no spines, 1 densely covered"),
    spineColor: hexColor,
    offsets: z.number().int().min(0).max(40).describe("Pups/offsets around the base"),
  }),
  condition: z.object({
    yellowing: unit("Share of leaf area yellowed"),
    brownTips: unit("Share of leaves with dry brown tips or edges"),
    pests: z.boolean(),
  }),
  pot: z.object({
    material: z.enum(["terracotta", "ceramic", "plastic", "none"]).describe("none if no pot is visible"),
    color: hexColor,
    diameterCm: z.number().min(2).max(200),
    fillRatio: unit("Plant canopy width / pot diameter, capped at 1"),
  }),
});
export type PlantVisual = z.infer<typeof PlantVisual>;

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
  healthNotes: z.string().describe("What is visible in the photo: yellowing, pests, dry tips, etc."),
  visual: PlantVisual.optional(),
});
export type PlantProfile = z.infer<typeof PlantProfile>;

/** What Claude must return: same as PlantProfile but `visual` is required, so it is never skipped. */
export const PlantProfileOut = PlantProfile.extend({ visual: PlantVisual });

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

/** A scanned/identified plant kept in a user's collection (today: web/src/myPlants.ts, localStorage). */
export const SavedPlant = z.object({
  id: z.string().min(1).describe("Stable id for this saved instance, independent of species"),
  profile: PlantProfile,
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

export const WhatIfRequest = z.object({
  profile: PlantProfile,
  question: z.string().min(1).max(500),
});

export const WhatIfResponse = z.object({
  profile: PlantProfile,
  explanation: z.string(),
});
export type WhatIfResponse = z.infer<typeof WhatIfResponse>;
