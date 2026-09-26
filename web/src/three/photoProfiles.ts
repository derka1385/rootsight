import { PlantScan } from "@rootsight/shared/schema";
import { fixtures } from "@rootsight/shared/fixtures";

type DeepPartial<T> = T extends (infer U)[] ? U[] : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** A lab scan: a fixture with its observation/growth patched (arrays are replaced, objects merged). */
function variant(base: PlantScan, patch: DeepPartial<PlantScan>): PlantScan {
  const merge = (a: unknown, b: unknown): unknown =>
    b && typeof b === "object" && !Array.isArray(b) && a && typeof a === "object" ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map(k => [k, merge((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])])) : b === undefined ? a : b;
  return PlantScan.parse(merge(base, patch));
}

const monstera = fixtures.monstera;

/** Scans for the fidelity lab: photographed references and one per renderer family. */
export const labScans: Record<string, PlantScan> = {
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
    growth: { stages: [{ ...monstera.growth.stages[0], heightCm: 60, canopyWidthCm: 63, leafCount: 16, axes: 4 }, ...monstera.growth.stages.slice(1).map(s => ({ ...s, axes: s.axes + 3, leafCount: s.leafCount + 8 }))] },
  }),
  // A rooted cutting: two entire leaves; the Future view walks it through every stage.
  "monstera-seedling": variant(monstera, {
    observation: {
      frame: { plantHeightCm: 12, canopyWidthCm: 16, leanDeg: 4 },
      pot: { shape: "cylinder", material: "ceramic", color: "#e9e4da", rimDiameterCm: 11, heightCm: 10 },
      leaves: { count: 2, lengthCmMin: 6, lengthCmMax: 8, fenestration: 0, shape: "cordate" },
      maturity: 0.05, stage: "SEEDLING",
    },
    growth: {
      stages: [
        { stage: "SEEDLING", monthsFromNow: 0, heightCm: 12, canopyWidthCm: 16, leafCount: 2, leafLengthCm: 8, maturity: 0.05, axes: 1, fenestration: 0, changes: [], confidence: 0.8 },
        { stage: "JUVENILE", monthsFromNow: 6, heightCm: 30, canopyWidthCm: 40, leafCount: 5, leafLengthCm: 16, maturity: 0.2, axes: 1, fenestration: 0.05, changes: ["Bigger heart-shaped leaves", "A first notch on the newest leaf"], confidence: 0.6 },
        { stage: "YOUNG", monthsFromNow: 14, heightCm: 60, canopyWidthCm: 75, leafCount: 8, leafLengthCm: 30, maturity: 0.45, axes: 1, fenestration: 0.45, changes: ["Holes along the midrib", "First marginal splits"], confidence: 0.5 },
        { stage: "MATURE", monthsFromNow: 28, heightCm: 120, canopyWidthCm: 110, leafCount: 11, leafLengthCm: 50, maturity: 0.8, axes: 1, fenestration: 0.75, changes: ["Deep splits and a second row of holes", "Aerial roots"], confidence: 0.45 },
        { stage: "LARGE_MATURE", monthsFromNow: 48, heightCm: 200, canopyWidthCm: 150, leafCount: 14, leafLengthCm: 70, maturity: 1, axes: 2, fenestration: 0.85, changes: ["Climbs a moss pole", "Lower leaves shed"], confidence: 0.35 },
      ],
    },
  }),
  // Dracaena fragrans "Massangeana"-like: three canes of different heights, arching striped strap leaves.
  dracaena: variant(monstera, {
    profile: { species: { commonName: "Corn plant", scientificName: "Dracaena fragrans", confidence: 0.9 }, wiki: { family: "Asparagaceae", nativeRegion: "Tropical Africa" }, morphology: { growthForm: "tree", matureHeightCm: 180, stemColor: "#7a6a4f", leaf: { shape: "lanceolate", color: "#2f5d2a", lengthCm: 45, countNow: 36 } }, roots: { type: "fibrous", maxDepthCm: 30, maxSpreadCm: 30 } },
    observation: {
      archetype: "cane",
      frame: { plantHeightCm: 110, canopyWidthCm: 80, leanDeg: 4, leanDirection: "center", symmetry: 0.6 },
      pot: { shape: "cylinder", material: "ceramic", color: "#d9d4ca", rimDiameterCm: 24, heightCm: 22 },
      structure: {
        axes: [{ kind: "cane", heightCm: 80, thicknessMm: 45, leanDeg: 3, direction: "center" }, { kind: "cane", heightCm: 55, thicknessMm: 40, leanDeg: 10, direction: "left" }, { kind: "cane", heightCm: 30, thicknessMm: 38, leanDeg: 12, direction: "right" }],
        leafClusters: [{ height: 0.9, direction: "center", share: 0.4 }, { height: 0.65, direction: "left", share: 0.33 }, { height: 0.4, direction: "right", share: 0.27 }],
        branching: 0,
      },
      leaves: { count: 36, density: 0.7, lengthCmMin: 25, lengthCmMax: 45, widthToLength: 0.12, shape: "strap", arrangement: "whorled", orientation: "arching", fenestration: 0, gloss: 0.6, variegation: "streaks" },
      colors: { leaf: "#2f5d2a", leafYoung: "#5f8f3a", underside: "#4a7040", stem: "#7a6a4f", variegation: "#c9c46a" },
      maturity: 0.6, stage: "MATURE",
    },
    growth: {
      habit: "upright",
      stages: [
        { stage: "MATURE", monthsFromNow: 0, heightCm: 110, canopyWidthCm: 80, leafCount: 36, leafLengthCm: 45, maturity: 0.6, axes: 3, fenestration: 0, changes: [], confidence: 0.8 },
        { stage: "MATURE", monthsFromNow: 18, heightCm: 140, canopyWidthCm: 95, leafCount: 52, leafLengthCm: 50, maturity: 0.75, axes: 4, fenestration: 0, changes: ["Canes lengthen, lower leaves drop", "A side shoot breaks below the tallest crown"], confidence: 0.55 },
        { stage: "LARGE_MATURE", monthsFromNow: 40, heightCm: 175, canopyWidthCm: 110, leafCount: 70, leafLengthCm: 55, maturity: 0.95, axes: 6, fenestration: 0, changes: ["Several crowns per cane", "Bare, ringed trunks below"], confidence: 0.4 },
      ],
    },
  }),
};
