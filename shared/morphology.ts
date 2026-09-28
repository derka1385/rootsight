import { z } from "zod";

const unit = z.number().min(0).max(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const layer = z.enum(["foreground", "middle", "background"]);

/** Observation coordinates exclude the pot: x spans half canopy width, y is soil-to-tip height. */
export const LeafObservation = z.object({
  id: z.string().min(1).max(64),
  x: z.number().min(-1).max(1),
  y: z.number().min(-1.5).max(1.5),
  layer,
  size: z.number().min(0.15).max(1.5).describe("Blade length / morphology.leaf.lengthCm"),
  angleDeg: z.number().min(0).max(180).describe("Blade axis from upward vertical; 90 horizontal, 180 hanging"),
  azimuthDeg: z.number().min(-180).max(180).describe("0 toward photo camera, 90 photo-right, -90 photo-left"),
  stemIndex: z.number().int().min(0).max(11),
});

/** A flower, bud or fruit (or one cluster of them) seen in the photo, in the same frame as leaves. */
export const BloomObservation = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["flower", "bud", "fruit"]),
  x: z.number().min(-1).max(1),
  y: z.number().min(-0.5).max(1.6).describe("Centre height above soil / plant height; above-foliage flowers can reach the top (1)"),
  layer,
  florets: z.number().int().min(1).max(80).describe("1 for one flower; >1 when this landmark is a cluster, umbel or spike of small flowers"),
  facing: z.enum(["up", "out", "down"]).describe("Where the open face points: up, out toward the viewer/side, or nodding down"),
});

/** Reproductive organs visible on THIS plant. Counts include estimated hidden ones; nothing is invented. */
export const BloomInventory = z.object({
  flowers: z.number().int().min(0).max(400).describe("Open flowers (or florets of clustered flowers) visible now; 0 if none"),
  buds: z.number().int().min(0).max(400).describe("Closed flower buds visible now"),
  fruits: z.number().int().min(0).max(200).describe("Fruits/berries/pods visible now"),
  flowerColor: hex.describe("Petal colour sampled from lit petals"),
  centerColor: hex.describe("Eye/centre/stamen colour, or the petal base colour"),
  budColor: hex,
  fruitColor: hex,
  flowerDiameterCm: z.number().min(0.2).max(40).describe("One open flower (or floret) across, measured against the pot"),
  fruitDiameterCm: z.number().min(0.1).max(30),
  placement: z.enum(["above-foliage", "terminal", "among-foliage", "axillary", "basal"]).describe("Where flowers sit relative to the leaves"),
  stalkCm: z.number().min(0).max(120).describe("Length of the flower stalks (peduncles) as seen"),
  landmarks: z.array(BloomObservation).max(24).describe("Up to 24 clearly visible flowers/buds/fruits or clusters, largest first"),
});

/** A main stem as photographed: where it leaves the soil and where it ends, in the leaf frame. */
export const StemObservation = z.object({
  baseX: z.number().min(-1).max(1),
  tipX: z.number().min(-1.5).max(1.5),
  tipY: z.number().min(0).max(1.5).describe("Tip height / plant height"),
  layer,
  thicknessMm: z.number().min(0.5).max(300),
});

/**
 * Coarse silhouette of the FOLIAGE in the photo: 8 rows (top of the plant first) of 8 digits (photo left
 * to right) over the plant's bounding box without the pot; 0 = background, 9 = solid leaves.
 */
export const Occupancy = z.array(z.string().regex(/^[0-9]{8}$/)).length(8);

/** Photo observations override botanical priors; absent observations never imply hidden certainty. */
export const IndividualPlantProfile = z.object({
  seed: z.string().min(1).max(128).optional(),
  crownShape: z.enum(["oval", "round", "fan", "column", "trailing", "dome", "mound", "vase", "spreading", "irregular"]).optional(),
  crownDensity: unit.describe("0.2 sparse, see-through; 0.5 medium; 0.8+ dense, opaque canopy").optional(),
  maturity: unit.optional(),
  estimatedBranchCount: z.number().int().min(0).max(32).optional(),
  averageLeafAngleDeg: z.number().min(0).max(180).optional(),
  leafAsymmetry: unit.optional(),
  stemTaper: unit.optional(),
  stemCurvature: unit.optional(),
  depthToWidth: z.number().min(0.05).max(1).optional(),
  occupancy: Occupancy.optional(),
  stems: z.array(StemObservation).max(12).optional(),
  leaves: z.array(LeafObservation).max(32).superRefine((leaves, ctx) => {
    if (new Set(leaves.map(leaf => leaf.id)).size !== leaves.length) ctx.addIssue({ code: "custom", message: "Leaf IDs must be unique" });
  }).optional(),
  blooms: BloomInventory.optional(),
});
export type IndividualPlantProfile = z.infer<typeof IndividualPlantProfile>;
export type LeafObservation = z.infer<typeof LeafObservation>;
export type BloomObservation = z.infer<typeof BloomObservation>;
export type BloomInventory = z.infer<typeof BloomInventory>;
export type StemObservation = z.infer<typeof StemObservation>;
