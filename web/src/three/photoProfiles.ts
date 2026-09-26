import { fixtures } from "@rootsight/shared/fixtures";
import type { VisualProfile } from "./visual";

/** Hand-estimated observations from the three linked photos in docs/fidelity/diagnosis.md. */
export const photoProfiles: Record<string, VisualProfile> = {
  "photo-monstera": {
    ...fixtures.monstera,
    morphology: { ...fixtures.monstera.morphology, currentHeightCm: 60, leaf: { ...fixtures.monstera.morphology.leaf, countNow: 16, lengthCm: 32 } },
    visual: { seed: "kipogeorgiki-01", silhouette: { widthToHeight: 1.05, leanDeg: 5, leanDirectionDeg: 20, symmetry: 0.58 }, stems: { count: 4, thicknessCm: 0.65 }, leaves: { widthToLength: 0.8, sizeVariation: 0.4, fenestration: 0.48, gloss: 0.68, curl: 0.3, droop: 0.08 }, pot: { color: "#a95932", material: "plastic", diameterToHeight: 0.37, heightToDiameter: 0.94 } },
  },
  "photo-basil": {
    ...fixtures.basil,
    morphology: { ...fixtures.basil.morphology, currentHeightCm: 22, leaf: { ...fixtures.basil.morphology.leaf, countNow: 54, lengthCm: 9, color: "#478325" } },
    visual: { seed: "carrefour-01", silhouette: { widthToHeight: 1.15, symmetry: 0.8 }, stems: { count: 6, thicknessCm: 0.22, internodeCm: 3 }, leaves: { widthToLength: 0.64, arrangement: "opposite", sizeVariation: 0.3, curl: 0.65, gloss: 0.6, droop: 0.28, edge: "serrated" }, pot: { color: "#ac4d2e", material: "plastic", diameterToHeight: 0.6, heightToDiameter: 0.85 } },
  },
  "photo-cactus": {
    ...fixtures.cactus,
    morphology: { ...fixtures.cactus.morphology, currentHeightCm: 7, stemColor: "#245939", leaf: { ...fixtures.cactus.morphology.leaf, lengthCm: 1.4 } },
    visual: { seed: "klorofyllverket-01", silhouette: { widthToHeight: 0.85 }, cactus: { form: "globe", ribs: 13, spineDensity: 0.45, spineColor: "#f0ead3", offsets: 0 }, pot: { color: "#303b54", material: "plastic", diameterToHeight: 1.05, heightToDiameter: 0.85 } },
  },
};

/** Synthetic architecture/finish checks; these are not claims about any reference photograph. */
export const architectureProfiles: Record<string, VisualProfile> = {
  // A rooted Monstera cutting: two small entire leaves; growth should walk it through every stage.
  "monstera-seedling": { ...fixtures.monstera, morphology: { ...fixtures.monstera.morphology, currentHeightCm: 12, leaf: { ...fixtures.monstera.morphology.leaf, lengthCm: 8, countNow: 2 } }, visual: { seed: "cutting-01", stems: { count: 1, thicknessCm: 0.5 }, leaves: { fenestration: 0, widthToLength: 0.85, gloss: 0.7 }, pot: { material: "ceramic", color: "#e9e4da", diameterToHeight: 0.9, heightToDiameter: 0.9 } } },
  vine: { ...fixtures.monstera, morphology: { ...fixtures.monstera.morphology, growthForm: "vine", currentHeightCm: 45, leaf: { shape: "ovate", color: "#427236", lengthCm: 10, countNow: 24 } }, visual: { stems: { count: 3, thicknessCm: 0.25 }, leaves: { base: "heart", fenestration: 0, variegation: "marbled", variegationAmount: 0.35 }, pot: { material: "ceramic", color: "#dbd6c9", diameterToHeight: 0.42 } } },
  grass: { ...fixtures.monstera, morphology: { ...fixtures.monstera.morphology, growthForm: "grass", currentHeightCm: 40, leaf: { shape: "lanceolate", color: "#456749", lengthCm: 42, countNow: 11 } }, visual: { silhouette: { widthToHeight: 0.6 }, stems: { count: 2 }, leaves: { base: "tapered", widthToLength: 0.13, fenestration: 0, curl: 0.3, variegation: "margin", variegationAmount: 0.28, variegationColor: "#cfba65" } } },
  succulent: { ...fixtures.basil, morphology: { ...fixtures.basil.morphology, growthForm: "succulent", currentHeightCm: 8, leaf: { shape: "round", color: "#789c84", lengthCm: 8, countNow: 26 } }, visual: { silhouette: { widthToHeight: 1.6 }, cactus: { form: "rosette" }, stems: { count: 1 }, leaves: { base: "tapered", tip: "rounded", widthToLength: 0.5, curl: 0.55, gloss: 0.05 }, pot: { diameterToHeight: 1.3, heightToDiameter: 0.5 } } },
  tree: { ...fixtures.monstera, morphology: { ...fixtures.monstera.morphology, growthForm: "tree", currentHeightCm: 65, stemColor: "#736346", leaf: { shape: "ovate", color: "#355a32", lengthCm: 17, countNow: 16 } }, visual: { stems: { count: 1, thicknessCm: 1.5, internodeCm: 9 }, leaves: { base: "rounded", fenestration: 0, arrangement: "alternate", gloss: 0.65 }, condition: { legginess: 0.5, yellowing: 0.15, brownTips: 0.35 }, pot: { color: "#d4cbb4", material: "ceramic" } } },
};
