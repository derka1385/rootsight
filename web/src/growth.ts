import type { GrowthStage, PlantState } from "@rootsight/shared/schema";
import { simulate } from "@rootsight/shared/simulation";
import type { SavedPlant } from "./myPlants";

const MONTH_MS = 30.44 * 86_400_000;

/** When a plant joined the collection: ids are Date.now() in base 36 (see myPlants.ts). */
export function addedAt(p: SavedPlant): number {
  const t = parseInt(p.id, 36);
  return Number.isFinite(t) && t > 1_500_000_000_000 && t <= Date.now() ? t : p.lastWateredAt;
}

/** Months since the scan: a saved plant keeps growing along its stages while it sits in the garden. */
export const monthsSince = (p: SavedPlant) => (Date.now() - addedAt(p)) / MONTH_MS;

/** Where a saved plant is today on its growth path. */
export const stateToday = (p: SavedPlant): PlantState => simulate(p.profile, monthsSince(p));

export const STAGE_LABEL: Record<GrowthStage, string> = {
  SEEDLING: "Seedling", JUVENILE: "Juvenile", YOUNG: "Young", MATURE: "Mature", LARGE_MATURE: "Large mature",
};

/** Development stage label and progress (0..1 leaf/structural maturity) for the UI. */
export const stageOf = (state: PlantState) => ({ pct: state.leafMaturity, label: STAGE_LABEL[state.stage] });
