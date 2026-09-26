import { useEffect, useState, type DragEvent } from "react";
import type { ImageInput, PlantScan } from "@rootsight/shared/schema";
import * as api from "../api";
import SceneCanvas from "../components/SceneCanvas";

/**
 * Photo lab: a desktop test bench for the photo -> Claude -> 3D pipeline.
 * Upload a photo, see what Claude returned field by field, compare the render with the photo, refine.
 */

type Health = { mock: boolean; hasKey: boolean; model: string };
type Pass = { n: number; ms: number; changed: string[]; corrections: string[] };

async function toJpeg(file: File, maxSide = 1568): Promise<ImageInput> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return { imageBase64: c.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" };
}

function screenshot(): ImageInput {
  const url = document.querySelector<HTMLCanvasElement>(".lab-render canvas")!.toDataURL("image/jpeg", 0.85);
  return { imageBase64: url.split(",")[1], mediaType: "image/jpeg" };
}

/** Paths of leaf values that differ between two profiles. */
function changed(a: unknown, b: unknown, path = ""): string[] {
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => changed((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [path];
}

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const fmt = (v: unknown) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v));

function Fields({ obj, highlight, prefix }: { obj: Record<string, unknown>; highlight: Set<string>; prefix: string }) {
  return (
    <dl className="lab-fields">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className={highlight.has(`${prefix}.${k}`) ? "hot" : undefined}>
          <dt>{k}</dt>
          <dd>
            {isHex(v) && <i className="swatch" style={{ background: v }} />}
            {typeof v === "number" && v >= 0 && v <= 1 && !Number.isInteger(v) && <span className="bar"><i style={{ width: `${v * 100}%` }} /></span>}
            {fmt(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function Lab() {
  const [health, setHealth] = useState<Health | null>(null);
  const [photo, setPhoto] = useState<ImageInput | null>(null);
  const [scan, setScan] = useState<PlantScan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [analyzeMs, setAnalyzeMs] = useState(0);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);
  useEffect(() => {
    if (!busy) return;
    const t0 = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, [busy]);

  const lastChanged = new Set(passes.at(-1)?.changed ?? []);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    const img = await toJpeg(file);
    setPhoto(img);
    setScan(null);
    setPasses([]);
    run("Claude is identifying the plant", async () => {
      const t0 = performance.now();
      setScan(await api.analyze(img));
      setAnalyzeMs(performance.now() - t0);
    });
  }

  const refine = () =>
    run("Claude is comparing the render with the photo", async () => {
      const t0 = performance.now();
      const { scan: next, corrections } = await api.refine(photo!, screenshot(), scan!);
      setPasses((ps) => [...ps, { n: ps.length + 1, ms: performance.now() - t0, changed: changed(scan!.observation, next.observation).map((p) => `observation.${p}`), corrections }]);
      setScan(next);
    });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    pick(e.dataTransfer.files[0]);
  };


  return (
    <div className="lab">
      <header className="lab-head">
        <div>
          <p className="eyebrow">Rootsight</p>
          <h1 className="title">Photo lab</h1>
        </div>
        {health === null ? (
          <span className="chip clay">API unreachable: run npm run dev</span>
        ) : health.mock ? (
          <span className="chip clay" title="Set USE_MOCK=false and ANTHROPIC_API_KEY in server/.env, then restart">Mock mode: every photo returns the sample monstera</span>
        ) : (
          <span className="chip leaf">Live · {health.model}{health.hasKey ? "" : " · no API key!"}</span>
        )}
      </header>

      <section className="lab-compare">
        <label className={`lab-drop${drag ? " drag" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
          {photo ? <img src={`data:${photo.mediaType};base64,${photo.imageBase64}`} alt="Uploaded plant" /> : (
            <span className="lab-hint"><b>Drop a plant photo here</b><br />or click to choose one (JPEG, PNG, HEIC from Safari)</span>
          )}
          <input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <span className="lab-tag">Photo</span>
        </label>
        <div className="lab-render">
          {scan ? <SceneCanvas scan={scan} mode="scanned" /> : <span className="lab-hint">{busy ? "…" : "The 3D render appears here"}</span>}
          <span className="lab-tag">3D render</span>
        </div>
      </section>

      <div className="lab-actions">
        {busy && <span className="lab-busy" role="status"><i className="spinner" /> {busy}… {elapsed.toFixed(1)} s</span>}
        {!busy && scan && <span className="muted small">Analyzed in {(analyzeMs / 1000).toFixed(1)} s{passes.length ? ` · ${passes.length} refine pass${passes.length > 1 ? "es" : ""}` : ""}</span>}
        <span style={{ flex: 1 }} />
        {scan && photo && <button className="btn" disabled={!!busy} onClick={refine}>Refine: compare render with photo</button>}
        {photo && <label className="btn ghost">New photo<input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} /></label>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {scan && (
        <div className="lab-results">
          <section className="card">
            <p className="eyebrow">Identified as</p>
            <h2 style={{ fontSize: 26 }}>{scan.profile.species.commonName}</h2>
            <p className="muted" style={{ margin: "2px 0 10px", fontStyle: "italic" }}>{scan.profile.species.scientificName} · {scan.profile.wiki.family}</p>
            <div className="row small"><span>Confidence</span><span className="bar wide"><i style={{ width: `${scan.profile.species.confidence * 100}%` }} /></span><b>{Math.round(scan.profile.species.confidence * 100)}%</b></div>
            <p style={{ marginBottom: 0 }}><b>Health:</b> {scan.observation.health.notes}</p>
          </section>

          <section className="card">
            <p className="eyebrow">observation</p>
            <Fields obj={{ archetype: scan.observation.archetype, stage: scan.observation.stage, maturity: scan.observation.maturity, ...scan.observation.frame }} highlight={lastChanged} prefix="observation.frame" />
          </section>
          {(["pot", "leaves", "colors", "health", "confidence"] as const).map((group) => (
            <section key={group} className="card">
              <p className="eyebrow">observation.{group}</p>
              <Fields obj={scan.observation[group] as Record<string, unknown>} highlight={lastChanged} prefix={`observation.${group}`} />
            </section>
          ))}
          <section className="card">
            <p className="eyebrow">observation.structure</p>
            {scan.observation.structure.axes.map((a, i) => <Fields key={i} obj={a} highlight={lastChanged} prefix={`observation.structure.axes.${i}`} />)}
            {scan.observation.structure.leafClusters.map((c, i) => <Fields key={`c${i}`} obj={c} highlight={lastChanged} prefix={`observation.structure.leafClusters.${i}`} />)}
          </section>
          <section className="card lab-wide">
            <p className="eyebrow">growth ({scan.growth.habit}, {scan.growth.source})</p>
            {scan.growth.stages.map((st) => (
              <p key={st.stage + st.monthsFromNow} style={{ margin: "6px 0" }}>
                <b>{st.stage}</b> at +{st.monthsFromNow} mo · {st.heightCm} cm · {st.leafCount} leaves · {st.axes} axes · maturity {st.maturity.toFixed(2)}
                <br /><span className="small muted">{st.changes.join(" · ") || "today"}</span>
              </p>
            ))}
          </section>

          {passes.length > 0 && (
            <section className="card lab-wide">
              <p className="eyebrow">Refine history</p>
              {passes.map((p) => (
                <p key={p.n} style={{ margin: "6px 0" }}>
                  <b>Pass {p.n}</b> · {(p.ms / 1000).toFixed(1)} s · {p.changed.length} field{p.changed.length === 1 ? "" : "s"} changed
                  <br /><span className="small muted">{p.corrections.join(" · ")}</span>
                  <br /><span className="small muted">{p.changed.join(", ") || "nothing: the render already matches"}</span>
                </p>
              ))}
            </section>
          )}

          <details className="card lab-wide">
            <summary>Raw JSON returned by the API</summary>
            <pre>{JSON.stringify(scan, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
