import { z } from "zod";

/**
 * How the SPECIES flowers and fruits (form, petals, inflorescence): botanical knowledge Claude returns
 * with the identification, even when the photographed plant is not in bloom. Colours here are the
 * species' typical ones; the photo's own colours live in IndividualPlantProfile.blooms.
 */
export const SpeciesFlowering = z.object({
  form: z.enum(["simple", "cup", "star", "bell", "trumpet", "daisy", "double", "orchid", "spathe", "reflexed", "tubular"])
    .describe("simple = open flat 4-6 petals; reflexed = petals swept back like cyclamen; spathe = one bract around a spadix (anthurium, peace lily); daisy = many narrow ray petals"),
  petals: z.number().int().min(0).max(40).describe("Petals (or tepals) per flower"),
  petalWidthToLength: z.number().min(0.1).max(1.5),
  inflorescence: z.enum(["solitary", "cluster", "umbel", "spike", "panicle", "spadix"]),
  flowerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  centerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fruit: z.enum(["none", "berry", "capsule", "pod", "drupe", "fig", "pepo"]),
});
export type SpeciesFlowering = z.infer<typeof SpeciesFlowering>;

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
  flowering: SpeciesFlowering,
});
export type SpeciesProfile = z.infer<typeof SpeciesProfile>;
const generic: SpeciesProfile = {
  id: "broadleaf", topology: "branching",
  leaf: { base: "tapered", widthToLength: 0.6, fold: 0.08, thickness: 0.006, curl: 0.2, venation: "pinnate", juvenileFenestration: 0, matureFenestration: 0 },
  structure: { branchAngleDeg: 40, taper: 0.65, curvature: 0.25, branchRadius: 0.48, petioleRadius: 0.2 },
  roots: { lateralGrowth: 0.65 },
  growth: { nodeSpacing: 0.14, juvenileScale: 0.6, senescence: 0.08 },
  // Only drawn when the photo shows flowers; the species' own structure (from Claude) replaces it.
  flowering: { form: "simple", petals: 5, petalWidthToLength: 0.7, inflorescence: "solitary", flowerColor: "#f2f0e6", centerColor: "#e8c95a", fruit: "none" },
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
  // Leaves on long stalks from a basal crown (cyclamen, African violet, peace lily): aroid topology, no holes.
  rosette: preset("rosette", "aroid", { base: "heart", widthToLength: 0.85, fold: 0.06, curl: 0.25 }, { curvature: 0.3 }),
  generic,
};

type Identity = { species: { scientificName: string; flowering?: SpeciesFlowering }; morphology: { growthForm: string; branchingAngleDeg: number; leaf: { shape: string; countNow: number } } };
export function speciesProfileOf(p: Identity): SpeciesProfile {
  const preset = presetOf(p);
  return p.species.flowering ? { ...preset, flowering: p.species.flowering } : preset;
}

function presetOf(p: Identity): SpeciesProfile {
  const name = p.species.scientificName.toLowerCase(), m = p.morphology;
  if (m.growthForm === "succulent") return m.leaf.countNow === 0 ? SPECIES_PROFILES.cactus : SPECIES_PROFILES.succulent;
  if (m.growthForm === "vine" || m.growthForm === "grass" || m.growthForm === "tree") return SPECIES_PROFILES[m.growthForm];
  if (name.includes("monstera") || m.leaf.shape === "fenestrated") return SPECIES_PROFILES.monstera;
  if (name.includes("ocimum")) return SPECIES_PROFILES.basil;
  if (m.growthForm === "rosette") return SPECIES_PROFILES.rosette;
  return { ...generic, structure: { ...generic.structure, branchAngleDeg: m.branchingAngleDeg } };
}
