import type { PlantState } from "@rootsight/shared/schema";
import { architectureOf, type Archetype } from "./architecture";
import { clamp01, smoothstep } from "./procedural";
import { potDimensions, visualOf, type RenderProfile, type Visual } from "./visual";

/**
 * Everything the renderer needs, resolved once from (profile, simulated state, optional photo).
 * Components read this instead of re-deriving numbers from the raw profile, so the photo, the
 * growth model and the species reference all meet in one place.
 */
export type PlantRenderSpec = {
  seed: string;
  archetype: Archetype;
  /** True for Monstera-like aroids: basal crown, long petioles, maturity-driven fenestration. */
  monstera: boolean;
  heightM: number;
  /** 0 = just germinated, 1 = species maturity, from simulated height. */
  maturity: number;
  stage: GrowthStage;
  reference: GrowthReferenceStage;
  /** Leaf-form maturity of the newest leaf, anchored on the fenestration seen in the photo. */
  formMaturity: number;
  /** Continuous leaf count (never rounded, so new leaves can emerge gradually). */
  leafCount: number;
  /** Most leaves the plant keeps before the oldest are shed. */
  maxLeaves: number;
  /** Blade length (m) of a leaf with the newest leaf's form maturity. */
  leafLengthM: number;
  /** What the photo showed today: growth is always expressed relative to these. */
  today: { leafCount: number; leafLengthM: number; formMaturity: number; heightM: number };
  canopyWidthM: number;
  wilt: number;
  leaf: { color: string; undersideColor: string; gloss: number; widthToLength: number; droop: number; sizeVariation: number; yellowing: number; brownTips: number; variegation: Visual["leaves"]["variegation"]; variegationAmount: number; variegationColor: string };
  stem: { color: string; thicknessM: number; count: number };
  pot: { radius: number; depth: number } & Visual["pot"];
  visual: Visual;
};

export type GrowthStage = "SEEDLING" | "JUVENILE" | "YOUNG" | "MATURE" | "LARGE_MATURE";

/**
 * How a species looks at one point of its life, relative to its mature size. Internal for now:
 * a later phase can fill these from photos of real specimens at known ages.
 */
export interface GrowthReferenceStage {
  stage: GrowthStage;
  /** Fraction of the time to maturity. */
  relativeAge: number;
  /** Height / mature height. */
  relativeHeight: number;
  /** Canopy width / plant height. */
  canopyWidth: number;
  /** Average blade length / mature blade length. */
  averageLeafLength: number;
  /** Leaf-form maturity: 0 juvenile entire leaves, 1 fully adult leaves. */
  maturity: number;
  leafCountEstimate: number;
  /** Side shoots per metre of stem (0 for single-crown plants). */
  branchingDensity: number;
  morphologyNotes: string;
  /** How much to trust this row over the photo (0..1). */
  confidence: number;
}

const STAGES: GrowthStage[] = ["SEEDLING", "JUVENILE", "YOUNG", "MATURE", "LARGE_MATURE"];

/** Monstera deliciosa grown indoors, from cuttings/seedlings to a large plant on its own stem. */
const MONSTERA: GrowthReferenceStage[] = [
  { stage: "SEEDLING", relativeAge: 0.02, relativeHeight: 0.06, canopyWidth: 1.1, averageLeafLength: 0.12, maturity: 0, leafCountEstimate: 2, branchingDensity: 0, morphologyNotes: "Entire heart-shaped leaves on short upright petioles, no splits.", confidence: 0.6 },
  { stage: "JUVENILE", relativeAge: 0.15, relativeHeight: 0.16, canopyWidth: 1.35, averageLeafLength: 0.3, maturity: 0.18, leafCountEstimate: 5, branchingDensity: 0, morphologyNotes: "Solid leaves; the newest may show a first hole or notch.", confidence: 0.6 },
  { stage: "YOUNG", relativeAge: 0.4, relativeHeight: 0.3, canopyWidth: 1.4, averageLeafLength: 0.55, maturity: 0.5, leafCountEstimate: 8, branchingDensity: 0, morphologyNotes: "Marginal splits on the newest leaves, older leaves still entire.", confidence: 0.55 },
  { stage: "MATURE", relativeAge: 0.75, relativeHeight: 0.6, canopyWidth: 1.3, averageLeafLength: 0.85, maturity: 0.82, leafCountEstimate: 11, branchingDensity: 0.4, morphologyNotes: "Deep splits plus rows of holes along the midrib; aerial roots from the stem.", confidence: 0.5 },
  { stage: "LARGE_MATURE", relativeAge: 1, relativeHeight: 1, canopyWidth: 1.15, averageLeafLength: 1, maturity: 1, leafCountEstimate: 14, branchingDensity: 0.8, morphologyNotes: "Leggy climbing stem, lower leaves shed, huge fenestrated leaves up top.", confidence: 0.45 },
];

/** Species-agnostic fallback, deliberately low confidence: the photo wins over it. */
function genericReference(archetype: Archetype): GrowthReferenceStage[] {
  const leafy = archetype !== "cactus";
  return STAGES.map((stage, i) => {
    const t = i / 4;
    return {
      stage, relativeAge: [0.02, 0.15, 0.4, 0.75, 1][i], relativeHeight: [0.06, 0.18, 0.35, 0.65, 1][i],
      canopyWidth: archetype === "grass" ? 0.6 : 0.9, averageLeafLength: 0.3 + 0.7 * t, maturity: t,
      leafCountEstimate: leafy ? Math.round(4 + t * 40) : 0, branchingDensity: archetype === "branching" || archetype === "tree" ? t * 3 : 0,
      morphologyNotes: "Generic growth curve.", confidence: 0.25,
    };
  });
}

export function isMonstera(p: RenderProfile, v: Visual): boolean {
  const kind = architectureOf(p, v);
  if (kind !== "aroid" && kind !== "branching") return false; // a trailing or tree form keeps its own architecture
  return /monstera|rhaphidophora|thaumatophyllum/i.test(p.species.scientificName) || p.morphology.leaf.shape === "fenestrated" || (kind === "aroid" && v.leaves.fenestration > 0.2);
}

export function referenceTable(p: RenderProfile, v = visualOf(p)): GrowthReferenceStage[] {
  return isMonstera(p, v) ? MONSTERA : genericReference(architectureOf(p, v));
}

/** Interpolate the reference table at a maturity (relative height); stages blend, never snap. */
export function growthReference(table: GrowthReferenceStage[], maturity: number): GrowthReferenceStage {
  const m = clamp01(maturity);
  let i = 0;
  while (i < table.length - 2 && m > table[i + 1].relativeHeight) i++;
  const a = table[i], b = table[i + 1];
  const t = clamp01((m - a.relativeHeight) / (b.relativeHeight - a.relativeHeight));
  const lerp = (k: keyof GrowthReferenceStage) => (a[k] as number) + ((b[k] as number) - (a[k] as number)) * t;
  return {
    stage: t < 0.5 ? a.stage : b.stage,
    relativeAge: lerp("relativeAge"), relativeHeight: m, canopyWidth: lerp("canopyWidth"), averageLeafLength: lerp("averageLeafLength"),
    maturity: lerp("maturity"), leafCountEstimate: lerp("leafCountEstimate"), branchingDensity: lerp("branchingDensity"),
    morphologyNotes: t < 0.5 ? a.morphologyNotes : b.morphologyNotes, confidence: lerp("confidence"),
  };
}

export type RenderOptions = { leafColor?: string };

export function renderSpecOf(p: RenderProfile, state: PlantState, options: RenderOptions = {}): PlantRenderSpec {
  const v = visualOf(p), m = p.morphology;
  const archetype = architectureOf(p, v);
  const monstera = isMonstera(p, v);
  const K = Math.max(m.matureHeightCm, m.currentHeightCm);
  const maturity = clamp01(state.heightCm / K), maturity0 = clamp01(m.currentHeightCm / K);
  const table = referenceTable(p, v);
  const ref = growthReference(table, maturity), ref0 = growthReference(table, maturity0);
  // The photo is ground truth for today; the reference only says how things change from here.
  const observedForm = monstera ? Math.max(ref0.maturity * (1 - ref0.confidence), smoothstep(0, 0.85, v.leaves.fenestration)) : ref0.maturity;
  const progress = clamp01((state.heightCm - m.currentHeightCm) / Math.max(1, K - m.currentHeightCm));
  const formMaturity = clamp01(observedForm + (1 - observedForm) * progress);
  const count0 = Math.max(1, m.leaf.countNow);
  const leafCount = count0 * Math.max(0.35, ref.leafCountEstimate / Math.max(1, ref0.leafCountEstimate));
  const leafLengthM = m.leaf.lengthCm / 100 * (ref.averageLeafLength / Math.max(0.05, ref0.averageLeafLength)) ** 0.8;
  const pot = potDimensions(p);
  return {
    seed: v.seed, archetype, monstera,
    heightM: state.heightCm / 100, maturity, stage: ref.stage, reference: ref, formMaturity,
    leafCount: monstera ? Math.min(18, leafCount) : leafCount,
    maxLeaves: monstera ? Math.max(count0, Math.round(ref.leafCountEstimate * count0 / Math.max(1, ref0.leafCountEstimate)) + 2) : 999,
    leafLengthM,
    today: { leafCount: count0, leafLengthM: m.leaf.lengthCm / 100, formMaturity: observedForm, heightM: m.currentHeightCm / 100 },
    canopyWidthM: state.heightCm / 100 * v.silhouette.widthToHeight * (ref.canopyWidth / Math.max(0.2, ref0.canopyWidth)),
    wilt: state.wilt,
    leaf: {
      color: options.leafColor ?? m.leaf.color, undersideColor: v.leaves.undersideColor, gloss: v.leaves.gloss, widthToLength: v.leaves.widthToLength,
      droop: v.leaves.droop, sizeVariation: v.leaves.sizeVariation, yellowing: v.condition.yellowing, brownTips: v.condition.brownTips,
      variegation: v.leaves.variegation, variegationAmount: v.leaves.variegationAmount, variegationColor: v.leaves.variegationColor,
    },
    stem: { color: m.stemColor, thicknessM: v.stems.thicknessCm / 100, count: v.stems.count },
    pot: { ...v.pot, ...pot },
    visual: v,
  };
}
