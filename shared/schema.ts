// Shared contract between server and web. Announce any change here to the whole team.
import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/).describe("Hex color like #3a7d44");

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
});
export type PlantProfile = z.infer<typeof PlantProfile>;

/** Output of simulate(). */
export type PlantState = {
  heightCm: number;
  leafCount: number;
  rootDepthCm: number;
  rootSpreadCm: number;
  hydration: number; // 0-1
  wilt: number; // 0-1
};

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
