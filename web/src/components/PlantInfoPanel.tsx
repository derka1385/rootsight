import type { PlantProfile, PlantState } from "@rootsight/shared/schema";

// TODO(ui-owner): real care card design, icons for light/humidity.
export default function PlantInfoPanel({ profile, state }: { profile: PlantProfile; state: PlantState }) {
  const { species, care } = profile;
  return (
    <section>
      <h2 style={{ margin: 0 }}>{species.commonName}</h2>
      <p style={{ margin: "2px 0 12px", fontStyle: "italic", opacity: 0.7 }}>
        {species.scientificName} · {Math.round(species.confidence * 100)}% sure
      </p>

      <h3>Care</h3>
      <ul>
        <li>💧 Water every {care.waterIntervalDays} days</li>
        <li>☀️ Light: {care.light}</li>
        <li>💨 Humidity: {care.humidity}</li>
        <li>🌡️ {care.tempMinC}–{care.tempMaxC} °C</li>
        <li>🪴 {care.soil}</li>
      </ul>

      <h3>Right now (simulated)</h3>
      <p>
        {Math.round(state.heightCm)} cm · {state.leafCount} leaves · roots {Math.round(state.rootDepthCm)} cm deep ·
        hydration {Math.round(state.hydration * 100)}%
      </p>

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
