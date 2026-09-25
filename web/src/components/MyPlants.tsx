import type { PlantProfile } from "@rootsight/shared/schema";
import { daysUntilWater, type useMyPlants } from "../myPlants";

// TODO(ui-owner): photo thumbnail per plant, watering badge, swipe to delete.
export default function MyPlants({ myPlants, onOpen }: { myPlants: ReturnType<typeof useMyPlants>; onOpen: (p: PlantProfile) => void }) {
  return (
    <section>
      <h2>My plants</h2>
      {myPlants.plants.length === 0 && <p style={{ opacity: 0.7 }}>No plants yet. Snap one in the Plant tab, then tap “Save to my plants”.</p>}
      {myPlants.plants.map((p) => {
        const days = daysUntilWater(p);
        return (
          <div key={p.id} className="card">
            <button className="link" onClick={() => onOpen(p.profile)}>
              <strong>{p.profile.species.commonName}</strong> <em style={{ opacity: 0.7 }}>{p.profile.species.scientificName}</em>
            </button>
            <p style={{ margin: "6px 0" }}>{days <= 0 ? "💧 Needs water today" : `💧 Water in ${days} day${days > 1 ? "s" : ""}`}</p>
            <button onClick={() => myPlants.water(p.id)}>Watered ✓</button>{" "}
            <button onClick={() => myPlants.remove(p.id)}>Remove</button>
          </div>
        );
      })}
    </section>
  );
}
