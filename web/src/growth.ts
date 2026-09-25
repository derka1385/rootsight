import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import { simulate } from "@rootsight/shared/simulation";
import type { SavedPlant } from "./myPlants";

const MONTH_MS = 30.44 * 86_400_000;

/** When a plant joined the collection: ids are Date.now() in base 36 (see myPlants.ts). */
export function addedAt(p: SavedPlant): number {
  const t = parseInt(p.id, 36);
  return Number.isFinite(t) && t > 1_500_000_000_000 && t <= Date.now() ? t : p.lastWateredAt;
}

/** Simulated state today, counting the months it has spent in the collection. */
export function stateToday(p: SavedPlant): PlantState {
  return simulate(p.profile, (Date.now() - addedAt(p)) / MONTH_MS, p.profile.care.waterIntervalDays);
}

const STAGES = [
  [0.12, "Sprout"],
  [0.4, "Young"],
  [0.8, "Growing"],
  [Infinity, "Mature"],
] as const;

/** Development stage from height relative to the species' mature height. */
export function stageOf(profile: PlantProfile, state: PlantState) {
  const pct = Math.min(1, state.heightCm / Math.max(profile.morphology.matureHeightCm, 1));
  return { pct, label: STAGES.find(([limit]) => pct < limit)![1] };
}
