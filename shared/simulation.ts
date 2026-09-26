import type { GrowthConditions, GrowthStage, GrowthStagePlan, PlantScan, PlantState } from "./schema";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (t: number) => t * t * (3 - 2 * t);
const LIGHT = { low: 0, medium: 1, "bright-indirect": 2, "full-sun": 3 } as const;

/** Where the plant is on its growth path, `months` from the scan, under `conditions`. */
export type GrowthState = PlantState & {
  /** Continuous leaf count (the renderer lets new leaves emerge gradually). */
  leaves: number;
  canopyWidthCm: number;
  leafLengthCm: number;
  maturity: number;
  fenestration: number;
  axes: number;
  stage: GrowthStage;
  /** 0 dying .. 1 thriving: watering, light and pot room combined. */
  vigor: number;
  /** Months of healthy growth actually achieved (slower than calendar months under stress). */
  effectiveMonths: number;
  /** Structural changes of the stage being approached. */
  changes: string[];
};

export const defaultConditions = (scan: PlantScan): GrowthConditions => ({
  waterIntervalDays: scan.profile.care.waterIntervalDays,
  light: scan.profile.care.light,
  potDiameterCm: scan.observation.pot.rimDiameterCm,
});

/** How well the conditions suit the plant: hydration (0..1) and a growth pace multiplier. */
export function vigorOf(scan: PlantScan, c: GrowthConditions, canopyWidthCm: number) {
  // Under-watering: every extra "ideal interval" between waterings costs 50% hydration.
  const stress = Math.max(0, c.waterIntervalDays / scan.profile.care.waterIntervalDays - 1);
  const hydration = clamp01(1 - 0.5 * stress);
  // Over-watering (much more often than ideal) slows growth too: roots rot.
  const soggy = clamp01((scan.profile.care.waterIntervalDays / c.waterIntervalDays - 2) / 3);
  const lightGap = LIGHT[c.light] - LIGHT[scan.profile.care.light];
  const light = lightGap < 0 ? 1 + lightGap * 0.3 : 1 - Math.max(0, lightGap - 1) * 0.25;
  // A canopy far wider than its pot is root-bound: growth stalls until it is repotted.
  const room = clamp01(1.4 - canopyWidthCm / (c.potDiameterCm * 4));
  const pace = Math.max(0.05, (0.3 + 0.7 * hydration) * (1 - 0.6 * soggy) * light * (0.35 + 0.65 * room));
  const vigor = clamp01(scan.observation.health.vigor * 0.4 + pace * 0.6);
  return { hydration, pace, vigor };
}

function lerpStage(a: GrowthStagePlan, b: GrowthStagePlan, t: number) {
  const k = smooth(clamp01(t)), mix = (x: number, y: number) => x + (y - x) * k;
  return {
    heightCm: mix(a.heightCm, b.heightCm), canopyWidthCm: mix(a.canopyWidthCm, b.canopyWidthCm),
    leaves: mix(a.leafCount, b.leafCount), leafLengthCm: mix(a.leafLengthCm, b.leafLengthCm),
    maturity: mix(a.maturity, b.maturity), fenestration: mix(a.fenestration, b.fenestration), axes: mix(a.axes, b.axes),
    stage: k < 0.5 ? a.stage : b.stage, changes: b.changes,
  };
}

/** Pure and deterministic: same scan, months and conditions give the same state. Month 0 = the photo. */
export function growthAt(scan: PlantScan, months: number, conditions = defaultConditions(scan)): GrowthState {
  const stages = [...scan.growth.stages].sort((a, b) => a.monthsFromNow - b.monthsFromNow);
  const obs = scan.observation;
  // Stage 0 IS the photographed plant: never let the plan contradict what was observed.
  stages[0] = { ...stages[0], monthsFromNow: 0, heightCm: obs.frame.plantHeightCm, canopyWidthCm: obs.frame.canopyWidthCm, leafCount: obs.leaves.count, maturity: obs.maturity };
  const { hydration, pace, vigor } = vigorOf(scan, conditions, obs.frame.canopyWidthCm);
  const effectiveMonths = Math.max(0, months) * pace;
  let i = 0;
  while (i < stages.length - 2 && effectiveMonths > stages[i + 1].monthsFromNow) i++;
  const a = stages[i], b = stages[Math.min(i + 1, stages.length - 1)];
  const span = Math.max(1e-6, b.monthsFromNow - a.monthsFromNow);
  const s = a === b ? lerpStage(a, a, 0) : lerpStage(a, b, (effectiveMonths - a.monthsFromNow) / span);
  // Drought: shrinking turgor first (wilt), then fewer, smaller leaves.
  const wilt = clamp01(Math.max(obs.health.wilt, (0.7 - hydration) / 0.7));
  const size = clamp01(s.heightCm / Math.max(scan.profile.morphology.matureHeightCm, s.heightCm));
  const potDepthCm = obs.pot.heightCm * (conditions.potDiameterCm / obs.pot.rimDiameterCm);
  return {
    heightCm: s.heightCm * (1 - 0.15 * wilt),
    canopyWidthCm: s.canopyWidthCm,
    leaves: s.leaves * (1 - 0.25 * wilt * clamp01(months / 3)),
    leafCount: Math.round(s.leaves * (1 - 0.25 * wilt * clamp01(months / 3))),
    leafLengthCm: s.leafLengthCm, maturity: s.maturity, fenestration: s.fenestration, axes: s.axes, stage: s.stage,
    rootDepthCm: Math.min(potDepthCm * 0.95, scan.profile.roots.maxDepthCm * Math.max(0.25, size)),
    rootSpreadCm: Math.min(conditions.potDiameterCm * 0.9, scan.profile.roots.maxSpreadCm * Math.max(0.25, size)),
    hydration, wilt, vigor, effectiveMonths, changes: months > 0 ? s.changes : [],
  };
}

/** Months until the plant reaches targetCm under these conditions, or null if it never will. */
export function monthsToHeight(scan: PlantScan, targetCm: number, conditions = defaultConditions(scan)): number | null {
  if (targetCm <= scan.observation.frame.plantHeightCm) return 0;
  for (let m = 0.25; m <= 240; m += 0.25) if (growthAt(scan, m, conditions).heightCm >= targetCm) return m;
  return null;
}
