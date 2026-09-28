import { z } from "zod";

/** Independently optional observed visual controls; legacy profiles remain valid. */
const unit = z.number().min(0).max(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const PlantVisual = z.object({
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
});

export type PlantVisual = z.infer<typeof PlantVisual>;
