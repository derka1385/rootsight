import { PlantIdentification, type PlantProfile } from "@rootsight/shared/schema";
import { identifications } from "@rootsight/shared/fixtures";
import { buildPlantProfile, genericKnowledge } from "@rootsight/shared/knowledge";
import { librarySpecies } from "@rootsight/shared/species";

type DeepPartial<T> = T extends (infer U)[] ? U[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** A lab plant: a fixture identification with its observation patched, then the real enrichment + personalisation. */
function variant(base: PlantIdentification, patch: DeepPartial<PlantIdentification>): PlantProfile {
  const merge = (a: unknown, b: unknown): unknown =>
    b && typeof b === "object" && !Array.isArray(b) && a && typeof a === "object" ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map(k => [k, merge((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])])) : b === undefined ? a : b;
  const id = PlantIdentification.parse(merge(base, patch));
  return buildPlantProfile(id, librarySpecies(id.identity.scientificName) ?? genericKnowledge(id));
}

const monstera = identifications.monstera;

/** Profiles for the fidelity lab, on top of the demo fixtures. */
export const labScans: Record<string, PlantProfile> = {
  // Hand-estimated from docs/fidelity/diagnosis.md's Kipogeorgiki photo: a dense cluster in an orange nursery pot.
  "photo-monstera": variant(monstera, {
    observation: {
      frame: { plantHeightCm: 60, canopyWidthCm: 63, leanDeg: 5, leanDirection: "right", symmetry: 0.6 },
      pot: { shape: "nursery", material: "plastic", color: "#c8531f", rimDiameterCm: 22, heightCm: 20 },
      structure: {
        axes: [{ kind: "crown", heightCm: 3, thicknessMm: 15, leanDeg: 5, direction: "left" }, { kind: "crown", heightCm: 3, thicknessMm: 14, leanDeg: 8, direction: "right" }, { kind: "crown", heightCm: 2, thicknessMm: 12, leanDeg: 10, direction: "toward" }, { kind: "crown", heightCm: 2, thicknessMm: 12, leanDeg: 6, direction: "away" }],
        leafClusters: [{ height: 0.8, direction: "center", share: 0.45 }, { height: 0.6, direction: "left", share: 0.3 }, { height: 0.55, direction: "right", share: 0.25 }],
      },
      leaves: { count: 16, density: 0.8, lengthCmMin: 20, lengthCmMax: 30, fenestration: 0.3, gloss: 0.8, orientation: "arching" },
      colors: { leaf: "#2f6b1f", leafYoung: "#6aa33a" },
    },
  }),
  // A rooted cutting: two entire leaves; the Future view walks it through every stage of the species.
  "monstera-seedling": variant(monstera, {
    observation: {
      frame: { plantHeightCm: 12, canopyWidthCm: 16, leanDeg: 4 },
      pot: { shape: "cylinder", material: "ceramic", color: "#e9e4da", rimDiameterCm: 11, heightCm: 10 },
      leaves: { count: 2, lengthCmMin: 6, lengthCmMax: 8, fenestration: 0, shape: "cordate" },
      maturity: 0.05, stage: "SEEDLING",
    },
  }),
};
