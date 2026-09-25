import type { PlantProfile, PlantState } from "./schema";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Pure and deterministic: same inputs, same PlantState. */
export function simulate(profile: PlantProfile, month: number, waterIntervalDays: number): PlantState {
  const { currentHeightCm: h0, matureHeightCm: hMax, leaf } = profile.morphology;

  // Under-watering: every extra "ideal interval" between waterings costs 50% hydration.
  // TODO(3d-owner): tune; over-watering (root rot) is not modelled yet.
  const stress = Math.max(0, waterIntervalDays / profile.care.waterIntervalDays - 1);
  const hydration = clamp01(1 - 0.5 * stress);
  // TODO(3d-owner): tune the wilt threshold (starts below 70% hydration).
  const wilt = clamp01((0.7 - hydration) / 0.7);

  // Logistic growth from h0 toward hMax, ~mature at monthsToMaturity.
  // TODO(3d-owner): tune the rate constant; maybe blend in growth.rateCmPerMonth.
  const r = 4 / profile.growth.monthsToMaturity;
  const K = Math.max(hMax, h0);
  const logistic = K / (1 + ((K - h0) / h0) * Math.exp(-r * month));
  // A thirsty plant grows slower.
  const heightCm = h0 + (logistic - h0) * (0.3 + 0.7 * hydration);

  const size = heightCm / K;
  return {
    heightCm,
    // TODO(3d-owner): leaves per growthForm (a cactus shouldn't sprout 40 leaves).
    leafCount: Math.round(leaf.countNow * (heightCm / h0)),
    rootDepthCm: profile.roots.maxDepthCm * size,
    rootSpreadCm: profile.roots.maxSpreadCm * size,
    hydration,
    wilt,
  };
}
