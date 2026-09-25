import { useState } from "react";
import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import { weeksToHeight } from "@rootsight/shared/simulation";

type Props = { profile: PlantProfile; state: PlantState; waterIntervalDays: number };

// TODO(ui-owner): real care card design, icons for light/humidity.
export default function PlantInfoPanel({ profile, state, waterIntervalDays }: Props) {
  const { species, wiki, care } = profile;
  const [targetCm, setTargetCm] = useState(Math.ceil((profile.morphology.currentHeightCm * 1.5) / 10) * 10);
  const weeks = weeksToHeight(profile, targetCm, waterIntervalDays);

  return (
    <section>
      <h2 style={{ margin: 0 }}>{species.commonName}</h2>
      <p style={{ margin: "2px 0 12px", fontStyle: "italic", opacity: 0.7 }}>
        {species.scientificName} · {Math.round(species.confidence * 100)}% sure
      </p>
      <p>{wiki.summary}</p>
      <p style={{ opacity: 0.8 }}>
        Family {wiki.family} · from {wiki.nativeRegion} · {wiki.difficulty} to grow
        {wiki.toxicToPets && " · ⚠️ toxic to pets"}
      </p>

      <h3>Growth tracker</h3>
      <p>
        Reaches{" "}
        <input
          type="number"
          min={1}
          value={targetCm}
          onChange={(e) => setTargetCm(+e.target.value)}
          style={{ width: 70 }}
        />{" "}
        cm{" "}
        {weeks === null
          ? "never with this watering"
          : weeks === 0
            ? "already 🎉"
            : `in ~${weeks} week${weeks > 1 ? "s" : ""}`}
      </p>
      <p>
        Simulated now: {Math.round(state.heightCm)} cm · {state.leafCount} leaves · roots {Math.round(state.rootDepthCm)} cm
        deep · hydration {Math.round(state.hydration * 100)}%
      </p>

      <h3>Care</h3>
      <ul>
        <li>💧 Water every {care.waterIntervalDays} days</li>
        <li>☀️ Light: {care.light}</li>
        <li>💨 Humidity: {care.humidity}</li>
        <li>🌡️ {care.tempMinC}–{care.tempMaxC} °C</li>
        <li>🪴 Soil: {care.soil}</li>
      </ul>

      <h3>Health</h3>
      <p>{profile.healthNotes}</p>

      <h3>Fun facts</h3>
      <ul>
        {profile.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </section>
  );
}
