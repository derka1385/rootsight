import type { PlantProfile, PlantState } from "./schema";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Shared by simulate() and weeksToHeight() so the two always agree.
function growthModel(profile: PlantProfile, waterIntervalDays: number) {
  // Under-watering: every extra "ideal interval" between waterings costs 50% hydration.
  // TODO(3d-owner): tune; over-watering (root rot) is not modelled yet.
  const stress = Math.max(0, waterIntervalDays / profile.care.waterIntervalDays - 1);
  const hydration = clamp01(1 - 0.5 * stress);

  // Logistic growth from h0 toward K, ~mature at monthsToMaturity.
  // TODO(3d-owner): tune the rate constant; maybe blend in growth.rateCmPerMonth.
  const h0 = profile.morphology.currentHeightCm;
  const K = Math.max(profile.morphology.matureHeightCm, h0);
  return {
    hydration,
    h0,
    K,
    r: 4 / profile.growth.monthsToMaturity,
    A: (K - h0) / h0,
    g: 0.3 + 0.7 * hydration, // a thirsty plant grows slower
  };
}

/** Pure and deterministic: same inputs, same PlantState. */
export function simulate(profile: PlantProfile, month: number, waterIntervalDays: number): PlantState {
  const { hydration, h0, K, r, A, g } = growthModel(profile, waterIntervalDays);
  const heightCm = h0 + (K / (1 + A * Math.exp(-r * month)) - h0) * g;
  // TODO(3d-owner): tune the wilt threshold (starts below 70% hydration).
  const wilt = clamp01((0.7 - hydration) / 0.7);

  const size = heightCm / K;
  return {
    heightCm,
    // TODO(3d-owner): leaves per growthForm (a cactus shouldn't sprout 40 leaves).
    leafCount: Math.round(profile.morphology.leaf.countNow * (heightCm / h0)),
    rootDepthCm: profile.roots.maxDepthCm * size,
    rootSpreadCm: profile.roots.maxSpreadCm * size,
    hydration,
    wilt,
  };
}

/** Weeks until the plant reaches targetCm (inverse of simulate), or null if it never will with this watering. */
export function weeksToHeight(profile: PlantProfile, targetCm: number, waterIntervalDays: number): number | null {
  const { h0, K, r, A, g } = growthModel(profile, waterIntervalDays);
  if (targetCm <= h0) return 0;
  const logisticHeight = h0 + (targetCm - h0) / g;
  if (logisticHeight >= K) return null;
  const months = -Math.log((K / logisticHeight - 1) / A) / r;
  return Math.ceil((months * 52) / 12);
}
