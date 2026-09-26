import type { GrowthConditions, GrowthStageReference, PlantProfile, PlantState } from "./schema";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (t: number) => t * t * (3 - 2 * t);
const LIGHT = { low: 0, medium: 1, "bright-indirect": 2, "full-sun": 3 } as const;

export const defaultConditions = (p: PlantProfile, waterIntervalDays = p.care.waterIntervalDays): GrowthConditions => ({
  waterIntervalDays, light: p.care.light, potDiameterCm: p.observation.pot.rimDiameterCm, pace: 1,
});

/** How well the conditions suit the plant: hydration (0..1), a growth pace multiplier and vigor. */
export function vigorOf(p: PlantProfile, c: GrowthConditions, canopyWidthCm = p.observation.frame.canopyWidthCm) {
  // Under-watering: every extra "ideal interval" between waterings costs 50% hydration.
  const stress = Math.max(0, c.waterIntervalDays / p.care.waterIntervalDays - 1);
  const hydration = clamp01(1 - 0.5 * stress);
  // Watering far more often than ideal slows growth too: soggy roots rot.
  const soggy = clamp01((p.care.waterIntervalDays / c.waterIntervalDays - 2) / 3);
  const lightGap = LIGHT[c.light] - LIGHT[p.care.light];
  const light = lightGap < 0 ? 1 + lightGap * 0.3 : 1 - Math.max(0, lightGap - 1) * 0.25;
  // A canopy far wider than its pot is root-bound: growth stalls until it is repotted.
  const room = clamp01(1.4 - canopyWidthCm / (c.potDiameterCm * 4));
  const pace = Math.max(0.05, (0.3 + 0.7 * hydration) * (1 - 0.6 * soggy) * light * (0.35 + 0.65 * room) * c.pace);
  const vigor = clamp01(p.observation.health.vigor * 0.4 + Math.min(1, pace) * 0.6);
  return { hydration, pace, vigor };
}

function between(a: GrowthStageReference, b: GrowthStageReference, t: number) {
  const k = smooth(clamp01(t)), mix = (x: number, y: number) => x + (y - x) * k;
  return {
    heightCm: mix(a.heightCm, b.heightCm), canopyWidthCm: mix(a.canopyWidthCm, b.canopyWidthCm), leaves: mix(a.leafCount, b.leafCount),
    leafLengthCm: mix(a.leafLengthCm, b.leafLengthCm), leafMaturity: mix(a.leafMaturity, b.leafMaturity), fenestration: mix(a.fenestration, b.fenestration),
    axes: mix(a.axes, b.axes), branchingDensity: mix(a.branchDensity, b.branchDensity), stemThicknessMm: mix(a.stemThicknessMm, b.stemThicknessMm),
    stage: k < 0.5 ? a.stage : b.stage, changes: b.morphologicalNotes,
  };
}

/**
 * The plant `month` months after the scan. Morphology comes from the personalised growth stages
 * (profile.stages; stages[0] is the photo); watering, light, pot room and care set how fast the plant
 * moves along them and how stressed it looks. Pure and deterministic: same inputs, same PlantState.
 */
export function simulate(profile: PlantProfile, month: number, waterIntervalDays = profile.care.waterIntervalDays, conditions?: Partial<GrowthConditions>): PlantState {
  const c = { ...defaultConditions(profile, waterIntervalDays), ...conditions, waterIntervalDays };
  const stages = [...profile.stages].sort((a, b) => a.monthsFromNow - b.monthsFromNow);
  const o = profile.observation;
  const { hydration, pace, vigor } = vigorOf(profile, c);
  const effectiveMonths = Math.max(0, month) * pace;
  let i = 0;
  while (i < stages.length - 2 && effectiveMonths > stages[i + 1].monthsFromNow) i++;
  const a = stages[i], b = stages[Math.min(i + 1, stages.length - 1)];
  const t = a === b ? 0 : clamp01((effectiveMonths - a.monthsFromNow) / Math.max(1e-6, b.monthsFromNow - a.monthsFromNow));
  const s = between(a, b, t);
  // Drought: turgor goes first (wilt, droop), then fewer and smaller leaves if it lasts.
  const wilt = clamp01(Math.max(o.health.wilt, (0.7 - hydration) / 0.7));
  const lasting = clamp01(month / 3);
  const leaves = s.leaves * (1 - 0.25 * wilt * lasting);
  const potDepthCm = o.pot.heightCm * (c.potDiameterCm / o.pot.rimDiameterCm);
  const size = clamp01(s.heightCm / Math.max(profile.prior.matureHeightCm, s.heightCm));
  const rootDepthCm = Math.min(potDepthCm * 0.95, profile.prior.roots.maxDepthCm * Math.max(0.25, size));
  const rootSpreadCm = Math.min(c.potDiameterCm * 0.9, profile.prior.roots.maxSpreadCm * Math.max(0.25, size));
  return {
    stage: s.stage, stageIndex: i + t,
    heightCm: s.heightCm * (1 - 0.15 * wilt), canopyWidthCm: s.canopyWidthCm,
    leafCount: Math.round(leaves), leaves, leafLengthCm: s.leafLengthCm, leafMaturity: s.leafMaturity, fenestration: s.fenestration,
    axes: s.axes, branchingDensity: s.branchingDensity, stemThicknessMm: s.stemThicknessMm,
    rootMass: clamp01((rootDepthCm / potDepthCm) * (rootSpreadCm / (c.potDiameterCm * 0.9)) * (0.4 + 0.6 * size)), rootDepthCm, rootSpreadCm,
    hydration, wilt, droop: clamp01(wilt * 0.85 + (o.leaves.orientation === "drooping" ? 0.3 : 0)),
    vitality: clamp01(vigor * (1 - 0.6 * wilt) * (1 - 0.3 * o.health.yellowing)),
    effectiveMonths, changes: month > 0 ? s.changes : [],
  };
}

/** Months until the plant reaches targetCm, or null if it never will under these conditions. */
export function monthsToHeight(profile: PlantProfile, targetCm: number, waterIntervalDays = profile.care.waterIntervalDays, conditions?: Partial<GrowthConditions>): number | null {
  if (targetCm <= profile.observation.frame.plantHeightCm) return 0;
  for (let m = 0.25; m <= 240; m += 0.25) if (simulate(profile, m, waterIntervalDays, conditions).heightCm >= targetCm) return m;
  return null;
}
