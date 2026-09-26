import {
  PlantProfile, type Archetype, type GrowthStageReference, type PlantIdentification, type PlantObservation,
  type SpeciesKnowledge, type SpeciesMorphologyPrior, type SpeciesStage,
} from "./schema";

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolate a species stage table at a relative age (0..1). */
export function speciesAt(stages: SpeciesStage[], age: number) {
  const s = [...stages].sort((a, b) => a.relativeAge - b.relativeAge);
  let i = 0;
  while (i < s.length - 2 && age > s[i + 1].relativeAge) i++;
  const a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  const t = a === b ? 0 : clamp((age - a.relativeAge) / (b.relativeAge - a.relativeAge), 0, 1);
  return {
    relativeHeight: lerp(a.relativeHeight, b.relativeHeight, t), canopyWidthToHeight: lerp(a.canopyWidthToHeight, b.canopyWidthToHeight, t),
    leafMin: lerp(a.leafCount.min, b.leafCount.min, t), leafMax: lerp(a.leafCount.max, b.leafCount.max, t),
    leafMaturity: lerp(a.leafMaturity, b.leafMaturity, t), fenestration: lerp(a.fenestration, b.fenestration, t),
    axes: lerp(a.axes, b.axes, t), branchDensity: lerp(a.branchDensity, b.branchDensity, t), stage: t < 0.5 ? a.stage : b.stage,
  };
}

/** Relative age at which the species reaches a relative height (inverse of speciesAt, monotonic). */
function ageAtHeight(stages: SpeciesStage[], relativeHeight: number) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (speciesAt(stages, mid).relativeHeight < relativeHeight) lo = mid; else hi = mid; }
  return hi;
}

const speciesLeafLength = (prior: SpeciesMorphologyPrior, leafMaturity: number) =>
  lerp(prior.leafLengthCm.juvenile.max, prior.leafLengthCm.mature.max, leafMaturity);

/**
 * Map the species' life stages onto THIS plant. Stage 0 is exactly the observation. Future stages
 * start from the plant's own deviations (denser, wider, bigger-leaved than the species average) and
 * converge toward the species' typical form as it matures. Pure and deterministic.
 */
export function personalizeStages(o: PlantObservation, k: SpeciesKnowledge): GrowthStageReference[] {
  const prior = k.prior;
  const H = prior.matureHeightCm;
  const age0 = ageAtHeight(k.stages, clamp(o.frame.plantHeightCm / H, 0.005, 1));
  const at0 = speciesAt(k.stages, age0);
  const heightAt = (age: number) => speciesAt(k.stages, age).relativeHeight * H;
  // How this individual differs from the species average at its age.
  const leafMid0 = Math.max(1, (at0.leafMin + at0.leafMax) / 2);
  const leafMaturity0 = clamp(Math.max(at0.leafMaturity, o.maturity, o.leaves.fenestration / Math.max(0.05, prior.fenestrationMature)), 0, 1);
  const dev = {
    width: clamp(o.frame.canopyWidthCm / Math.max(1, o.frame.plantHeightCm * at0.canopyWidthToHeight), 0.4, 2.5),
    leaves: prior.archetype === "cactus" ? 1 : clamp(o.leaves.count / leafMid0, 0.3, 3),
    leafLength: clamp(o.leaves.lengthCmMax / Math.max(0.5, speciesLeafLength(prior, leafMaturity0)), 0.4, 2.5),
  };
  const thickness0 = o.structure.axes[0]?.thicknessMm ?? prior.stem.matureThicknessMm * 0.3;
  const today: GrowthStageReference = {
    stage: o.stage, relativeAge: age0, monthsFromNow: 0, relativeHeight: clamp(o.frame.plantHeightCm / H, 0, 1),
    heightCm: o.frame.plantHeightCm, canopyWidthCm: o.frame.canopyWidthCm,
    expectedLeafCount: { min: Math.round(at0.leafMin), max: Math.round(at0.leafMax) }, leafCount: o.leaves.count,
    leafLengthCm: o.leaves.lengthCmMax, leafMaturity: leafMaturity0, fenestration: o.leaves.fenestration,
    axes: Math.max(1, o.structure.axes.length), branchDensity: o.structure.branching, stemThicknessMm: thickness0,
    morphologicalNotes: [], confidence: Math.min(o.confidence.structure, o.confidence.size), source: "observation",
  };
  // One future stage per distinct age (normalised references sometimes repeat an age), strictly later than today.
  const ages = [...new Set(k.stages.map(s => Math.round(s.relativeAge * 1000) / 1000))].sort((a, b) => a - b).filter(a => a > age0 + 0.03);
  // Already mature: still show where it is heading (a fuller version of itself) a quarter-cycle on.
  if (!ages.length) ages.push(Math.min(1.25, age0 + 0.25));
  const future = ages.map((age): GrowthStageReference => {
    const s = speciesAt(k.stages, Math.min(1, age));
    const p = clamp((age - age0) / Math.max(0.05, 1 - age0), 0, 1);
    const fade = (d: number) => lerp(d, 1, p * 0.7); // individual quirks fade toward the species form
    const heightCm = Math.max(o.frame.plantHeightCm, heightAt(Math.min(1, age)) * (age > 1 ? 1 + (age - 1) * 0.4 : 1));
    const leafMaturity = Math.max(leafMaturity0, s.leafMaturity);
    const source = k.sources.some(x => x.provider === "library") ? "library" : k.sources.some(x => x.provider === "generic") ? "generic" : "reference";
    const stage = k.stages.findLast(x => Math.abs(x.relativeAge - age) < 1e-3);
    return {
      stage: stage?.stage ?? s.stage, relativeAge: Math.min(1, age), monthsFromNow: Math.round((age - age0) * prior.monthsToMaturity * 10) / 10,
      relativeHeight: clamp(heightCm / H, 0, 1), heightCm, canopyWidthCm: heightCm * s.canopyWidthToHeight * fade(dev.width),
      expectedLeafCount: { min: Math.round(s.leafMin), max: Math.round(s.leafMax) },
      leafCount: Math.max(o.leaves.count, (s.leafMin + s.leafMax) / 2 * fade(dev.leaves)),
      leafLengthCm: Math.max(o.leaves.lengthCmMax, speciesLeafLength(prior, leafMaturity) * fade(dev.leafLength)),
      leafMaturity, fenestration: Math.max(o.leaves.fenestration, s.fenestration),
      axes: Math.max(today.axes, Math.round(s.axes)), branchDensity: Math.max(today.branchDensity, s.branchDensity),
      stemThicknessMm: Math.max(thickness0, prior.stem.matureThicknessMm * Math.pow(heightCm / H, 0.8)),
      morphologicalNotes: stage?.morphologicalNotes ?? [], confidence: clamp(0.8 - p * 0.4, 0.2, 0.8), source,
    };
  });
  return [today, ...future];
}

/** The app-facing profile: what the photo shows + what the species is known to do. */
export function buildPlantProfile(id: PlantIdentification, knowledge: SpeciesKnowledge): PlantProfile {
  return PlantProfile.parse({ ...id, prior: knowledge.prior, stages: personalizeStages(id.observation, knowledge), sources: knowledge.sources });
}

// ---- Generic fallback: no curated entry and no live references ----------------------------------

type Defaults = Pick<SpeciesMorphologyPrior, "growthHabit" | "branchingPattern" | "leafArrangement" | "canopyForm" | "canopyWidthToHeight"> & { structure: SpeciesMorphologyPrior["stem"]["structure"]; months: number; leaves: [number, number]; axes: [number, number] };
const DEFAULTS: Record<Archetype, Defaults> = {
  aroid: { growthHabit: "clumping", branchingPattern: "basal-clump", leafArrangement: "basal", canopyForm: "spreading", canopyWidthToHeight: 1.1, structure: "crown", months: 36, leaves: [4, 14], axes: [1, 3] },
  cane: { growthHabit: "upright", branchingPattern: "sympodial", leafArrangement: "whorled", canopyForm: "vase", canopyWidthToHeight: 0.7, structure: "cane", months: 60, leaves: [10, 60], axes: [1, 4] },
  herb: { growthHabit: "bushy", branchingPattern: "opposite-pairs", leafArrangement: "opposite", canopyForm: "dome", canopyWidthToHeight: 0.9, structure: "herbaceous", months: 6, leaves: [8, 120], axes: [1, 8] },
  shrub: { growthHabit: "bushy", branchingPattern: "sympodial", leafArrangement: "alternate", canopyForm: "dome", canopyWidthToHeight: 0.9, structure: "woody", months: 48, leaves: [15, 150], axes: [1, 6] },
  succulent: { growthHabit: "rosette", branchingPattern: "offsets", leafArrangement: "rosette", canopyForm: "rosette", canopyWidthToHeight: 1.5, structure: "succulent-body", months: 36, leaves: [8, 40], axes: [1, 4] },
  cactus: { growthHabit: "columnar", branchingPattern: "offsets", leafArrangement: "none", canopyForm: "globe", canopyWidthToHeight: 1, structure: "succulent-body", months: 120, leaves: [0, 0], axes: [1, 3] },
  vine: { growthHabit: "trailing", branchingPattern: "basal-clump", leafArrangement: "alternate", canopyForm: "cascading", canopyWidthToHeight: 1.5, structure: "herbaceous", months: 24, leaves: [6, 100], axes: [2, 6] },
  grass: { growthHabit: "clumping", branchingPattern: "basal-clump", leafArrangement: "basal", canopyForm: "vase", canopyWidthToHeight: 0.8, structure: "crown", months: 30, leaves: [4, 40], axes: [1, 5] },
  tree: { growthHabit: "tree", branchingPattern: "monopodial", leafArrangement: "alternate", canopyForm: "column", canopyWidthToHeight: 0.6, structure: "woody", months: 72, leaves: [6, 70], axes: [1, 6] },
};

/**
 * Last-resort species knowledge from the observation alone (no curated entry, live enrichment off or
 * failed): the observed archetype's typical architecture and a generic five-stage life.
 */
export function genericKnowledge(id: PlantIdentification): SpeciesKnowledge {
  const o = id.observation, d = DEFAULTS[o.archetype];
  const matureHeightCm = Math.max(o.frame.plantHeightCm / Math.max(0.1, o.maturity), o.frame.plantHeightCm * 1.2);
  const len = Math.max(1, o.leaves.lengthCmMax);
  const prior: SpeciesMorphologyPrior = {
    archetype: o.archetype, growthHabit: d.growthHabit, branchingPattern: d.branchingPattern, leafArrangement: o.archetype === "cactus" ? "none" : d.leafArrangement,
    leafShape: o.leaves.shape, leafLengthCm: { juvenile: { min: len * 0.3, max: len * 0.7 }, mature: { min: len * 0.8, max: len * 1.4 } }, leafWidthToLength: o.leaves.widthToLength,
    stem: { structure: d.structure, matureThicknessMm: (o.structure.axes[0]?.thicknessMm ?? 10) * 2 }, petiole: { present: o.archetype === "aroid" || o.archetype === "vine", lengthToBlade: o.archetype === "aroid" ? 1 : 0.4 },
    canopyForm: d.canopyForm, canopyWidthToHeight: d.canopyWidthToHeight, roots: { type: "fibrous", maxDepthCm: Math.min(60, matureHeightCm * 0.4), maxSpreadCm: Math.min(60, matureHeightCm * 0.5) },
    matureHeightCm, monthsToMaturity: d.months, fenestrationMature: o.leaves.fenestration > 0.05 ? Math.max(0.6, o.leaves.fenestration) : 0,
    juvenileVsMature: "Generic growth pattern for this plant type (no species reference available).", notes: [],
  };
  const row = (stage: SpeciesStage["stage"], a: number, h: number, t: number): SpeciesStage => ({
    stage, relativeAge: a, relativeHeight: h, canopyWidthToHeight: d.canopyWidthToHeight,
    leafCount: { min: Math.round(lerp(d.leaves[0], d.leaves[1], t) * 0.7), max: Math.round(lerp(d.leaves[0], d.leaves[1], t) * 1.2) },
    leafMaturity: t, fenestration: prior.fenestrationMature * Math.max(0, t - 0.3) / 0.7, axes: Math.round(lerp(d.axes[0], d.axes[1], t)),
    branchDensity: d.branchingPattern === "none" ? 0 : t * 0.8, morphologicalNotes: [],
  });
  return {
    scientificName: id.identity.scientificName, prior,
    stages: [row("SEEDLING", 0.03, 0.06, 0), row("JUVENILE", 0.2, 0.2, 0.25), row("YOUNG", 0.45, 0.45, 0.55), row("MATURE", 0.75, 0.75, 0.85), row("LARGE_MATURE", 1, 1, 1)],
    sources: [{ provider: "generic", title: `Generic ${o.archetype} growth pattern` }],
  };
}
