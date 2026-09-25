import type { PlantProfile } from "@rootsight/shared/schema";
import { fixtures } from "@rootsight/shared/fixtures";

// TODO(ui-owner): images, search, categories. TODO(claude-owner): more profiles in shared/fixtures.
export default function Discover({ onOpen }: { onOpen: (p: PlantProfile) => void }) {
  return (
    <section>
      <h2>Discover</h2>
      {Object.values(fixtures).map((p) => (
        <button key={p.species.scientificName} className="card" onClick={() => onOpen(p)}>
          <strong>{p.species.commonName}</strong> <em style={{ opacity: 0.7 }}>{p.species.scientificName}</em>
          <p style={{ margin: "6px 0 0" }}>{p.wiki.summary}</p>
        </button>
      ))}
    </section>
  );
}
