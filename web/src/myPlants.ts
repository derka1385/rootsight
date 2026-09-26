import { useEffect, useState } from "react";
import { SavedPlant, type PlantProfile } from "@rootsight/shared/schema";

export type { SavedPlant };

const KEY = "rootsight.garden.v2"; // v2: scans (species + observation + growth), not bare profiles

function load(): SavedPlant[] {
  try {
    const saved: unknown[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Drop entries saved before a schema change instead of crashing.
    return saved.flatMap((p) => {
      const parsed = SavedPlant.safeParse(p);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

// ponytail: localStorage = one device only. Move to a backend if plants must sync (e.g. the iPhone app).
export function useMyPlants() {
  const [plants, setPlants] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(plants));
    } catch {}
  }, [plants]);

  return {
    plants,
    // Date.now id, not crypto.randomUUID: that one is missing over plain http (iPhone on LAN).
    add: (profile: PlantProfile, photoThumb?: string) => {
      const id = Date.now().toString(36);
      setPlants((ps) => [...ps, { id, profile, photoThumb, lastWateredAt: Date.now() }]);
      return id;
    },
    /** Refine/what-if results replace the stored profile so the garden keeps the best reconstruction. */
    update: (id: string, profile: PlantProfile) => setPlants((ps) => ps.map((p) => (p.id === id ? { ...p, profile } : p))),
    water: (id: string) => setPlants((ps) => ps.map((p) => (p.id === id ? { ...p, lastWateredAt: Date.now() } : p))),
    remove: (id: string) => setPlants((ps) => ps.filter((p) => p.id !== id)),
  };
}

export const daysUntilWater = (p: SavedPlant) =>
  Math.ceil(p.profile.care.waterIntervalDays - (Date.now() - p.lastWateredAt) / 86_400_000);
