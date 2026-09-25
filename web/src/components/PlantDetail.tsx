import { useMemo, useState } from "react";
import type { PlantProfile } from "@rootsight/shared/schema";
import { simulate, weeksToHeight } from "@rootsight/shared/simulation";
import { daysUntilWater, type SavedPlant } from "../myPlants";
import { addedAt, stageOf } from "../growth";
import SceneCanvas from "./SceneCanvas";
import { BackIcon, CloudIcon, DropIcon, LeafIcon, PlusIcon, SoilIcon, SparkIcon, SunIcon, ThermoIcon } from "./icons";

type Props = {
  profile: PlantProfile;
  saved: SavedPlant | null;
  busy: string | null;
  error: string;
  explanation: string;
  canRefine: boolean;
  onBack: () => void;
  onSave: () => void;
  onWater: () => void;
  onWhatIf: (question: string) => void;
  onRefine: () => void;
};

const LIGHT = { low: "Low light", medium: "Medium light", "bright-indirect": "Bright, indirect", "full-sun": "Full sun" };

export default function PlantDetail(p: Props) {
  const { profile, saved } = p;
  const age = saved ? (Date.now() - addedAt(saved)) / (30.44 * 86_400_000) : 0;
  const [month, setMonth] = useState(0);
  const [water, setWater] = useState(profile.care.waterIntervalDays);
  const [question, setQuestion] = useState("What if I water every 2 weeks?");
  const state = useMemo(() => simulate(profile, age + month, water), [profile, age, month, water]);
  const stage = stageOf(profile, state);
  const [target, setTarget] = useState(Math.ceil((profile.morphology.currentHeightCm * 1.5) / 10) * 10);
  const weeks = weeksToHeight(profile, target, water);
  const { species, wiki, care } = profile;

  return (
    <div className="detail">
      <div className="stage3d">
        <SceneCanvas state={state} profile={profile} />
        <div className="top-bar">
          <button className="icon-btn" onClick={p.onBack} aria-label="Back"><BackIcon /></button>
          {saved ? (
            <button className="btn water small" onClick={p.onWater}>
              <DropIcon /> {daysUntilWater(saved) <= 0 ? "Water now" : "Watered"}
            </button>
          ) : (
            <button className="btn small" onClick={p.onSave}><PlusIcon /> Add to garden</button>
          )}
        </div>
      </div>

      <div className="sheet">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="title" style={{ fontSize: 26 }}>{species.commonName}</h1>
            <p className="muted" style={{ margin: "2px 0 0", fontStyle: "italic" }}>{species.scientificName}</p>
          </div>
          <span className="chip leaf"><LeafIcon /> {stage.label}</span>
        </div>
        {saved && <p className="small muted" style={{ margin: "8px 0 0" }}>In your garden · {daysUntilWater(saved) <= 0 ? "needs water today" : `water in ${daysUntilWater(saved)} days`}</p>}

        <div className="metrics">
          <div className="metric"><b>{Math.round(state.heightCm)}</b><span>cm tall</span></div>
          <div className="metric"><b>{state.leafCount}</b><span>leaves</span></div>
          <div className="metric"><b>{Math.round(state.rootDepthCm)}</b><span>cm roots</span></div>
          <div className="metric"><b style={{ color: state.hydration < 0.7 ? "var(--clay)" : "var(--water)" }}>{Math.round(state.hydration * 100)}%</b><span>hydration</span></div>
        </div>

        <h2 className="section-title">Grow it</h2>
        <div className="card">
          <div className="slider">
            <div className="row"><label htmlFor="month">Time</label><output htmlFor="month">{month === 0 ? "Today" : `+${month} month${month > 1 ? "s" : ""}`}</output></div>
            <input id="month" type="range" min={0} max={24} value={month} onChange={(e) => setMonth(+e.target.value)} />
            <div className="progress"><i style={{ width: `${Math.max(3, stage.pct * 100)}%` }} /></div>
            <span className="small muted">{Math.round(stage.pct * 100)}% of its mature height ({profile.morphology.matureHeightCm} cm)</span>
          </div>
          <div className="slider water">
            <div className="row"><label htmlFor="water">Watering</label><output htmlFor="water">Every {water} day{water > 1 ? "s" : ""}</output></div>
            <input id="water" type="range" min={1} max={60} value={water} onChange={(e) => setWater(+e.target.value)} />
            <span className="small muted">Ideal: every {care.waterIntervalDays} days. Stretch it and watch the leaves droop.</span>
          </div>
          <p className="tracker" style={{ margin: "14px 0 0" }}>
            Reaches <input type="number" min={1} value={target} onChange={(e) => setTarget(+e.target.value)} aria-label="Target height in cm" /> cm{" "}
            <strong>{weeks === null ? "never with this watering" : weeks === 0 ? "already" : `in ~${weeks} week${weeks > 1 ? "s" : ""}`}</strong>
          </p>
        </div>

        <h2 className="section-title">Ask Claude</h2>
        <form className="ask" onSubmit={(e) => { e.preventDefault(); if (question.trim()) p.onWhatIf(question.trim()); }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="What-if question" />
          <button className="btn" disabled={!!p.busy}><SparkIcon /></button>
        </form>
        {p.busy && <p className="small muted" role="status">{p.busy}</p>}
        {p.error && <p className="error" role="alert">{p.error}</p>}
        {p.explanation && <p className="explanation">{p.explanation}</p>}
        {p.canRefine && <button className="btn ghost block" style={{ marginTop: 10 }} onClick={p.onRefine} disabled={!!p.busy}>Compare the 3D with my photo</button>}

        <h2 className="section-title">Care</h2>
        <div className="care">
          <div className="card"><DropIcon /><b>Every {care.waterIntervalDays} days</b><span className="small muted">Water</span></div>
          <div className="card"><SunIcon /><b>{LIGHT[care.light]}</b><span className="small muted">Light</span></div>
          <div className="card"><CloudIcon /><b style={{ textTransform: "capitalize" }}>{care.humidity}</b><span className="small muted">Humidity</span></div>
          <div className="card"><ThermoIcon /><b>{care.tempMinC}–{care.tempMaxC} °C</b><span className="small muted">Temperature</span></div>
        </div>
        <div className="card row" style={{ marginTop: 10 }}><SoilIcon /><span><b>Soil</b><br /><span className="small muted">{care.soil}</span></span></div>

        <h2 className="section-title">About</h2>
        <div className="card stack">
          <p style={{ margin: 0 }}>{wiki.summary}</p>
          <div className="chips">
            <span className="chip">{wiki.family}</span>
            <span className="chip">From {wiki.nativeRegion}</span>
            <span className="chip leaf">{wiki.difficulty[0].toUpperCase() + wiki.difficulty.slice(1)} to grow</span>
            {wiki.toxicToPets && <span className="chip clay">Toxic to pets</span>}
          </div>
        </div>

        <h2 className="section-title">Health</h2>
        <div className="card"><p style={{ margin: 0 }}>{profile.healthNotes}</p></div>

        <h2 className="section-title">Did you know?</h2>
        <div className="card"><ul className="facts">{profile.facts.map((f) => <li key={f}>{f}</li>)}</ul></div>
      </div>
    </div>
  );
}
