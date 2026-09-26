import type { PlantScan } from "@rootsight/shared/schema";
import { fixtures } from "@rootsight/shared/fixtures";
import { daysUntilWater, type SavedPlant, type useMyPlants } from "../myPlants";
import { stageOf, stateToday } from "../growth";
import PlantThumb from "./PlantThumb";
import { DropIcon, LeafIcon, ScanIcon } from "./icons";

type Props = {
  name: string;
  reminders: boolean;
  myPlants: ReturnType<typeof useMyPlants>;
  onOpenSaved: (p: SavedPlant) => void;
  onOpenSample: (s: PlantScan) => void;
  onScan: () => void;
};

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const waterLabel = (days: number) => (days <= 0 ? "Water today" : days === 1 ? "Water tomorrow" : `Water in ${days} days`);

export default function Home({ name, reminders, myPlants, onOpenSaved, onOpenSample, onScan }: Props) {
  const plants = myPlants.plants;
  const thirsty = plants.filter((p) => daysUntilWater(p) <= 0);
  const species = new Set(plants.map((p) => p.scan.profile.species.scientificName)).size;
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="screen">
      <p className="eyebrow">{date}</p>
      <h1 className="title">
        {greeting()}
        {name ? `, ${name}` : ""}
      </h1>

      {plants.length > 0 && (
        <div className="summary">
          <div className="card"><b>{plants.length}</b><span className="small muted">plants</span></div>
          <div className="card"><b>{species}</b><span className="small muted">species</span></div>
          <div className="card"><b style={{ color: thirsty.length ? "var(--water)" : undefined }}>{thirsty.length}</b><span className="small muted">need water</span></div>
        </div>
      )}

      {reminders && thirsty.length > 0 && (
        <div className="alert" role="status">
          <DropIcon />
          <p>{thirsty.length === 1 ? `${thirsty[0].scan.profile.species.commonName} is thirsty today` : `${thirsty.length} plants are thirsty today`}</p>
          <button className="btn water small" onClick={() => thirsty.forEach((p) => myPlants.water(p.id))}>Watered</button>
        </div>
      )}

      <h2 className="section-title">
        My garden {plants.length > 0 && <button className="btn ghost small" onClick={onScan}><ScanIcon /> Add</button>}
      </h2>

      {plants.length === 0 ? (
        <div className="card empty">
          <PlantThumb scan={fixtures.basil} className="hero-thumb" />
          <h3>Your garden is empty</h3>
          <p className="muted">Scan a plant and Rootsight shows how it will grow, when to water it and what its roots are doing.</p>
          <button className="btn block" onClick={onScan}><ScanIcon /> Scan my first plant</button>
        </div>
      ) : (
        <div className="grid2">
          {plants.map((p) => {
            const state = stateToday(p);
            const stage = stageOf(state);
            const days = daysUntilWater(p);
            return (
              <button key={p.id} className="plant-card" onClick={() => onOpenSaved(p)}>
                <div className="thumb"><PlantThumb scan={p.scan} /></div>
                <div className="stack" style={{ gap: 6 }}>
                  <h3>{p.scan.profile.species.commonName}</h3>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="chip leaf" style={{ padding: "3px 9px", fontSize: 12 }}><LeafIcon /> {stage.label}</span>
                    <span className="small muted">{Math.round(state.heightCm)} cm</span>
                  </div>
                  <div className="progress" aria-label={`${Math.round(stage.pct * 100)}% of mature height`}><i style={{ width: `${Math.max(4, stage.pct * 100)}%` }} /></div>
                  <span className="small" style={{ color: days <= 0 ? "var(--water)" : "var(--ink-2)", fontWeight: 600 }}>{waterLabel(days)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <h2 className="section-title">Explore</h2>
      <div className="samples">
        {Object.values(fixtures).map((s) => (
          <button key={s.profile.species.scientificName} className="sample" onClick={() => onOpenSample(s)}>
            <div className="thumb"><PlantThumb scan={s} /></div>
            <strong style={{ fontSize: 14 }}>{s.profile.species.commonName}</strong>
            <span className="small muted">{s.profile.wiki.difficulty} to grow</span>
          </button>
        ))}
      </div>
    </div>
  );
}
