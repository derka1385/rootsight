import { z } from "zod";

/** Botanical priors are configuration, not branches inside the renderer. */
export const SpeciesProfile = z.object({
  id: z.string(),
  topology: z.enum(["aroid", "branching", "cactus", "vine", "grass", "succulent", "tree"]),
  leaf: z.object({
    base: z.enum(["heart", "tapered", "rounded"]), widthToLength: z.number(),
    fold: z.number(), thickness: z.number(), curl: z.number(),
    venation: z.enum(["pinnate", "parallel", "subtle"]),
    juvenileFenestration: z.number(), matureFenestration: z.number(),
  }),
  structure: z.object({ branchAngleDeg: z.number(), taper: z.number(), curvature: z.number(), branchRadius: z.number(), petioleRadius: z.number() }),
  roots: z.object({ lateralGrowth: z.number() }),
  growth: z.object({ nodeSpacing: z.number(), juvenileScale: z.number(), senescence: z.number() }),
});
export type SpeciesProfile = z.infer<typeof SpeciesProfile>;
const generic: SpeciesProfile = {
  id: "broadleaf", topology: "branching",
  leaf: { base: "tapered", widthToLength: 0.6, fold: 0.08, thickness: 0.006, curl: 0.2, venation: "pinnate", juvenileFenestration: 0, matureFenestration: 0 },
  structure: { branchAngleDeg: 40, taper: 0.65, curvature: 0.25, branchRadius: 0.48, petioleRadius: 0.2 },
  roots: { lateralGrowth: 0.65 },
  growth: { nodeSpacing: 0.14, juvenileScale: 0.6, senescence: 0.08 },
};
function preset(id: string, topology: SpeciesProfile["topology"], leaf: Partial<SpeciesProfile["leaf"]> = {}, structure: Partial<SpeciesProfile["structure"]> = {}, growth: Partial<SpeciesProfile["growth"]> = {}): SpeciesProfile {
  return SpeciesProfile.parse({ ...generic, id, topology, leaf: { ...generic.leaf, ...leaf }, structure: { ...generic.structure, ...structure }, growth: { ...generic.growth, ...growth } });
}
export const SPECIES_PROFILES = {
  monstera: preset("monstera", "aroid", { base: "heart", widthToLength: 0.82, fold: 0.1, juvenileFenestration: 0.05, matureFenestration: 0.7 }, { curvature: 0.4 }),
  basil: preset("basil", "branching", { widthToLength: 0.6, curl: 0.4 }, { branchAngleDeg: 48, curvature: 0.3 }, { nodeSpacing: 0.12, senescence: 0.12 }),
  cactus: preset("cactus", "cactus", { thickness: 0.01 }),
  vine: preset("vine", "vine", { base: "heart", widthToLength: 0.75 }, { curvature: 0.65 }),
  grass: preset("strap", "grass", { widthToLength: 0.13, fold: 0.16, thickness: 0.012, venation: "parallel" }),
  succulent: preset("succulent", "succulent", { widthToLength: 0.48, thickness: 0.08, fold: 0.05, venation: "subtle" }),
  tree: preset("tree", "tree", { base: "rounded", thickness: 0.01 }, { branchAngleDeg: 52, branchRadius: 0.62, petioleRadius: 0.13 }),
  generic,
};

type Identity = { species: { scientificName: string }; morphology: { growthForm: string; branchingAngleDeg: number; leaf: { shape: string; countNow: number } } };
export function speciesProfileOf(p: Identity): SpeciesProfile {
  const name = p.species.scientificName.toLowerCase(), m = p.morphology;
  if (m.growthForm === "succulent") return m.leaf.countNow === 0 ? SPECIES_PROFILES.cactus : SPECIES_PROFILES.succulent;
  if (m.growthForm === "vine" || m.growthForm === "grass" || m.growthForm === "tree") return SPECIES_PROFILES[m.growthForm];
  if (name.includes("monstera") || m.leaf.shape === "fenestrated") return SPECIES_PROFILES.monstera;
  if (name.includes("ocimum")) return SPECIES_PROFILES.basil;
  if (m.growthForm === "rosette") return SPECIES_PROFILES.monstera;
  return { ...generic, structure: { ...generic.structure, branchAngleDeg: m.branchingAngleDeg } };
}
