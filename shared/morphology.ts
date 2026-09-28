import { z } from "zod";

const unit = z.number().min(0).max(1);
/** Observation coordinates exclude the pot: x spans half canopy width, y is soil-to-tip height. */
export const LeafObservation = z.object({
  id: z.string().min(1).max(64),
  x: z.number().min(-1).max(1),
  y: z.number().min(-1.5).max(1.5),
  layer: z.enum(["foreground", "middle", "background"]),
  size: z.number().min(0.15).max(1.5).describe("Blade length / morphology.leaf.lengthCm"),
  angleDeg: z.number().min(0).max(180).describe("Blade axis from upward vertical; 90 horizontal, 180 hanging"),
  azimuthDeg: z.number().min(-180).max(180).describe("0 toward photo camera, 90 photo-right, -90 photo-left"),
  stemIndex: z.number().int().min(0).max(11),
});

/** Photo observations override botanical priors; absent observations never imply hidden certainty. */
export const IndividualPlantProfile = z.object({
  seed: z.string().min(1).max(128).optional(),
  crownShape: z.enum(["oval", "round", "fan", "column", "trailing"]).optional(),
  crownDensity: unit.optional(),
  maturity: unit.optional(),
  estimatedBranchCount: z.number().int().min(0).max(32).optional(),
  averageLeafAngleDeg: z.number().min(0).max(180).optional(),
  leafAsymmetry: unit.optional(),
  stemTaper: unit.optional(),
  stemCurvature: unit.optional(),
  depthToWidth: z.number().min(0.05).max(1).optional(),
  leaves: z.array(LeafObservation).max(32).superRefine((leaves, ctx) => {
    if (new Set(leaves.map(leaf => leaf.id)).size !== leaves.length) ctx.addIssue({ code: "custom", message: "Leaf IDs must be unique" });
  }).optional(),
});
export type IndividualPlantProfile = z.infer<typeof IndividualPlantProfile>;
export type LeafObservation = z.infer<typeof LeafObservation>;
