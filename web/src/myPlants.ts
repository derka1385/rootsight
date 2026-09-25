import { useEffect, useState } from "react";
import { PlantProfile } from "@rootsight/shared/schema";

export type SavedPlant = { id: string; profile: PlantProfile; lastWateredAt: number };

const KEY = "rootsight.myPlants";

function load(): SavedPlant[] {
  try {
    const saved: SavedPlant[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Drop entries saved before a schema change instead of crashing.
    return saved.filter((p) => PlantProfile.safeParse(p.profile).success);
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
    add: (profile: PlantProfile) =>
      setPlants((ps) => [...ps, { id: Date.now().toString(36), profile, lastWateredAt: Date.now() }]),
    water: (id: string) => setPlants((ps) => ps.map((p) => (p.id === id ? { ...p, lastWateredAt: Date.now() } : p))),
    remove: (id: string) => setPlants((ps) => ps.filter((p) => p.id !== id)),
  };
}

export const daysUntilWater = (p: SavedPlant) =>
  Math.ceil(p.profile.care.waterIntervalDays - (Date.now() - p.lastWateredAt) / 86_400_000);
