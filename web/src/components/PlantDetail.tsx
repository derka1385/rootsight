import { useMemo, useState } from "react";
import type { GrowthConditions, PlantProfile } from "@rootsight/shared/schema";
import { monthsToHeight, simulate } from "@rootsight/shared/simulation";
import { daysUntilWater, type SavedPlant } from "../myPlants";
import { monthsSince, STAGE_LABEL } from "../growth";
import SceneCanvas from "./SceneCanvas";
import { BackIcon, CloudIcon, DropIcon, LeafIcon, PlusIcon, SoilIcon, SparkIcon, SunIcon, ThermoIcon } from "./icons";

type Props = {
  profile: PlantProfile;
  photoUrl: string | null;
  saved: SavedPlant | null;
  busy: string | null;
  error: string;
  explanation: string;
  corrections: string[];
  conditions: GrowthConditions;
  onConditions: (c: GrowthConditions) => void;
  canRefine: boolean;
  onBack: () => void;
  onSave: () => void;
  onWater: () => void;
  onWhatIf: (question: string) => void;
  onRefine: () => void;
};

type Mode = "scanned" | "future";
const LIGHT = { low: "Low light", medium: "Medium light", "bright-indirect": "Bright, indirect", "full-sun": "Full sun" } as const;
const LIGHTS = Object.keys(LIGHT) as (keyof typeof LIGHT)[];
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function PlantDetail(p: Props) {
  const { profile, saved, conditions } = p;
  const { observation: o, stages, identity, wiki, care, prior } = profile;
  const [mode, setMode] = useState<Mode>("scanned");
  const [roots, setRoots] = useState(false);
  // A saved plant has been growing since it was scanned: Future starts from "now".
  const since = saved ? monthsSince(saved) : 0;
  const horizon = Math.max(12, Math.min(120, Math.ceil(Math.max(...stages.map((s) => s.monthsFromNow)) * 1.15)));
  const [months, setMonths] = useState(Math.round(since));
  const [question, setQuestion] = useState("What if I water every 2 weeks?");
  const state = useMemo(() => simulate(profile, months, conditions.waterIntervalDays, conditions), [profile, months, conditions]);
  const [target, setTarget] = useState(Math.ceil((o.frame.plantHeightCm * 1.5) / 10) * 10);
  const toTarget = monthsToHeight(profile, target, conditions.waterIntervalDays, conditions);
  const set = (patch: Partial<GrowthConditions>) => p.onConditions({ ...conditions, ...patch });

  return (
    <div className="detail">
      <div className="stage3d">
        <SceneCanvas profile={profile} mode={mode} months={months} conditions={conditions} roots={mode === "future" && roots} padBottom={0.2} />
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
        {mode === "scanned" && p.photoUrl && (
          <figure className="photo-inset"><img src={p.photoUrl} alt="Your photo" /><figcaption>Your photo</figcaption></figure>
        )}
        <div className="mode-switch" role="tablist" aria-label="View">
          <button role="tab" aria-selected={mode === "scanned"} onClick={() => setMode("scanned")}>Scanned plant</button>
          <button role="tab" aria-selected={mode === "future"} onClick={() => setMode("future")}>Future growth</button>
        </div>
      </div>

      <div className="sheet">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 className="title" style={{ fontSize: 26 }}>{identity.commonName}</h1>
            <p className="muted" style={{ margin: "2px 0 0", fontStyle: "italic" }}>{identity.scientificName}</p>
          </div>
          <span className="chip leaf"><LeafIcon /> {STAGE_LABEL[mode === "scanned" ? o.stage : state.stage]}</span>
        </div>
        {saved && <p className="small muted" style={{ margin: "8px 0 0" }}>In your garden · {daysUntilWater(saved) <= 0 ? "needs water today" : `water in ${daysUntilWater(saved)} days`}</p>}

        {mode === "scanned" ? (
          <>
            <div className="metrics">
              <div className="metric"><b>{Math.round(o.frame.plantHeightCm)}</b><span>cm tall</span></div>
              <div className="metric"><b>{Math.round(o.frame.canopyWidthCm)}</b><span>cm wide</span></div>
              <div className="metric"><b>{o.leaves.count}</b><span>leaves</span></div>
              <div className="metric"><b>{o.structure.axes.length}</b><span>{o.structure.axes[0].kind}{o.structure.axes.length > 1 ? "s" : ""}</span></div>
            </div>
            <h2 className="section-title">Reconstruction</h2>
            <div className="card stack">
              <p style={{ margin: 0 }}>
                Rebuilt from your photo as {/^[aeiou]/.test(o.archetype) ? "an" : "a"} {o.archetype} plant: {o.leaves.orientation} {o.leaves.shape} leaves {o.leaves.lengthCmMin}–{o.leaves.lengthCmMax} cm long,
                in a {o.pot.shape} {o.pot.material} pot {Math.round(o.pot.rimDiameterCm)} cm across.
              </p>
              <div className="confidence">
                <span className="small muted">Species {pct(identity.confidence)}</span>
                <span className="small muted">Layout {pct(o.confidence.structure)}</span>
                <span className="small muted">Size {pct(o.confidence.size)}</span>
              </div>
              {p.corrections.length > 0 && <ul className="facts">{p.corrections.map((c) => <li key={c}>{c}</li>)}</ul>}
              {p.canRefine && <button className="btn ghost block" onClick={p.onRefine} disabled={!!p.busy}>Match my photo more closely</button>}
            </div>
          </>
        ) : (
          <>
            <div className="metrics">
              <div className="metric"><b>{Math.round(state.heightCm)}</b><span>cm tall</span></div>
              <div className="metric"><b>{state.leafCount}</b><span>leaves</span></div>
              <div className="metric"><b>{Math.round(state.canopyWidthCm)}</b><span>cm wide</span></div>
              <div className="metric"><b style={{ color: state.vitality < 0.5 ? "var(--clay)" : "var(--growth)" }}>{pct(state.vitality)}</b><span>vitality</span></div>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <div className="slider">
                <div className="row"><label htmlFor="month">Time</label><output htmlFor="month">{months === 0 ? "Today" : `+${months} month${months > 1 ? "s" : ""}`}</output></div>
                <input id="month" type="range" min={0} max={horizon} value={months} onChange={(e) => setMonths(+e.target.value)} />
                <div className="stage-ticks" aria-hidden="true">
                  {stages.map((s) => (
                    <button key={s.stage + s.monthsFromNow} style={{ left: `${Math.min(100, (s.monthsFromNow / horizon) * 100)}%` }} onClick={() => setMonths(Math.round(s.monthsFromNow))} tabIndex={-1}>{STAGE_LABEL[s.stage]}</button>
                  ))}
                </div>
              </div>
              <div className="chips" style={{ marginTop: 12 }}>
                <span className="chip">Leaf maturity {pct(state.leafMaturity)}</span>
                {state.fenestration > 0.05 && <span className="chip">Splits {pct(state.fenestration)}</span>}
                <span className="chip">{Math.round(state.axes)} {prior.stem.structure === "crown" ? "crown" : "stem"}{Math.round(state.axes) > 1 ? "s" : ""}</span>
                <span className="chip">Stem {Math.round(state.stemThicknessMm)} mm</span>
                {state.branchingDensity > 0.05 && <span className="chip">Branching {pct(state.branchingDensity)}</span>}
              </div>
              {state.changes.length > 0 && <ul className="facts" style={{ marginTop: 14 }}>{state.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
            </div>

            <h2 className="section-title">Conditions</h2>
            <div className="card">
              <div className="slider water">
                <div className="row"><label htmlFor="water">Watering</label><output htmlFor="water">Every {conditions.waterIntervalDays} day{conditions.waterIntervalDays > 1 ? "s" : ""}</output></div>
                <input id="water" type="range" min={1} max={60} value={conditions.waterIntervalDays} onChange={(e) => set({ waterIntervalDays: +e.target.value })} />
                <span className="small muted">Ideal: every {care.waterIntervalDays} days. Stretch it and watch the leaves droop.</span>
              </div>
              <div className="chips" style={{ marginTop: 14 }} role="group" aria-label="Light">
                {LIGHTS.map((l) => <button key={l} className={`chip${conditions.light === l ? " leaf" : ""}`} onClick={() => set({ light: l })}><SunIcon /> {LIGHT[l]}</button>)}
              </div>
              <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
                <span className="small">Pot: <b>{Math.round(conditions.potDiameterCm)} cm</b></span>
                <button className="btn ghost small" onClick={() => set({ potDiameterCm: Math.round(conditions.potDiameterCm * 1.3) })}>Repot bigger</button>
              </div>
              <label className="row" style={{ marginTop: 12, gap: 10 }}>
                <input type="checkbox" checked={roots} onChange={(e) => setRoots(e.target.checked)} /> <span className="small">Show roots (cut-away pot)</span>
              </label>
              <p className="tracker" style={{ margin: "14px 0 0" }}>
                Reaches <input type="number" min={1} value={target} onChange={(e) => setTarget(+e.target.value)} aria-label="Target height in cm" /> cm{" "}
                <strong>{toTarget === null ? "never under these conditions" : toTarget === 0 ? "already" : `in ~${Math.ceil(toTarget)} month${toTarget > 1 ? "s" : ""}`}</strong>
              </p>
            </div>

            <h2 className="section-title">Ask Claude</h2>
            <form className="ask" onSubmit={(e) => { e.preventDefault(); if (question.trim()) p.onWhatIf(question.trim()); }}>
              <input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="What-if question" />
              <button className="btn" disabled={!!p.busy} aria-label="Ask"><SparkIcon /></button>
            </form>
            {p.explanation && <p className="explanation">{p.explanation}</p>}
          </>
        )}
        {p.busy && <p className="small muted" role="status">{p.busy}</p>}
        {p.error && <p className="error" role="alert">{p.error}</p>}

        <h2 className="section-title">How it grows</h2>
        <div className="card stack">
          <p style={{ margin: 0 }}>{prior.juvenileVsMature}</p>
          {prior.notes.length > 0 && <ul className="facts">{prior.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          <p className="small muted" style={{ margin: 0 }}>
            Sources: {profile.sources.map((src, i) => <span key={src.title + i}>{i > 0 && " · "}{src.url ? <a href={src.url} target="_blank" rel="noreferrer">{src.title}</a> : src.title}</span>)}
          </p>
        </div>

        <h2 className="section-title">Care</h2>
        <div className="care">
          <div className="card"><DropIcon /><b>Every {care.waterIntervalDays} days</b><span className="small muted">Water</span></div>
          <div className="card"><SunIcon /><b>{LIGHT[care.light]}</b><span className="small muted">Light</span></div>
          <div className="card"><CloudIcon /><b style={{ textTransform: "capitalize" }}>{care.humidity}</b><span className="small muted">Humidity</span></div>
          <div className="card"><ThermoIcon /><b>{care.tempMinC}–{care.tempMaxC} °C</b><span className="small muted">Temperature</span></div>
        </div>
        <div className="card row" style={{ marginTop: 10 }}><SoilIcon /><span><b>Soil</b><br /><span className="small muted">{care.soil}</span></span></div>

        <h2 className="section-title">Health</h2>
        <div className="card"><p style={{ margin: 0 }}>{o.health.notes}</p></div>

        <h2 className="section-title">About</h2>
        <div className="card stack">
          <p style={{ margin: 0 }}>{wiki.summary}</p>
          <div className="chips">
            <span className="chip">{identity.family}</span>
            <span className="chip">From {wiki.nativeRegion}</span>
            <span className="chip leaf">{wiki.difficulty[0].toUpperCase() + wiki.difficulty.slice(1)} to grow</span>
            {wiki.toxicToPets && <span className="chip clay">Toxic to pets</span>}
          </div>
        </div>

        <h2 className="section-title">Did you know?</h2>
        <div className="card"><ul className="facts">{profile.facts.map((f) => <li key={f}>{f}</li>)}</ul></div>
      </div>
    </div>
  );
}
