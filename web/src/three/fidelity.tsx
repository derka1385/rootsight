import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import { PlantProfile } from "@rootsight/shared/schema";
import { fixtures } from "@rootsight/shared/fixtures";
import { defaultConditions } from "@rootsight/shared/simulation";
import SceneCanvas from "../components/SceneCanvas";
import { labScans } from "./photoProfiles";
import type { RenderMode } from "./renderPlan";

function Probe() {
  const gl = useThree(s => s.gl);
  useFrame(() => {
    gl.info.autoReset = false;
    gl.info.reset();
    requestAnimationFrame(() => {
      gl.domElement.dataset.peakCalls = String(Math.max(Number(gl.domElement.dataset.peakCalls ?? 0), gl.info.render.calls));
      gl.domElement.dataset.metrics = JSON.stringify({ peakCalls: Number(gl.domElement.dataset.peakCalls), calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures });
      gl.domElement.dataset.ready = "true";
    });
  }, -100);
  return null;
}

function Lab() {
  const params = new URLSearchParams(location.search);
  const catalog: Record<string, PlantProfile> = { ...fixtures, ...labScans };
  const [scan, setScan] = useState<PlantProfile>(catalog[params.get("profile") ?? "monstera"] ?? fixtures.monstera);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState("");
  const months = Number(params.get("month") ?? 0);
  const mode: RenderMode = params.get("mode") === "future" || months > 0 || params.has("water") ? "future" : "scanned";
  const conditions = { ...defaultConditions(scan), ...(params.has("water") ? { waterIntervalDays: Number(params.get("water")) } : {}) };
  const capture = params.has("capture");
  return <main style={{ fontFamily: "system-ui", background: "#f4efe7", minHeight: "100vh" }}>
    {!capture && <header style={{ padding: 16 }}><h1>Fidelity lab</h1><p>Pick a scan or load a PlantProfile JSON. ?month=N shows the Future view, &amp;water=N changes watering, &amp;roots shows the x-ray.</p>
      <label>Scan <select value={params.get("profile") ?? "monstera"} onChange={e => { location.search = `?profile=${e.target.value}`; }}>{Object.keys(catalog).map(k => <option key={k}>{k}</option>)}</select></label>{" "}
      <label>JSON <input type="file" accept="application/json" onChange={async e => { try { setScan(PlantProfile.parse(JSON.parse(await e.target.files![0].text()))); setError(""); } catch (err) { setError(String(err)); } }} /></label>{" "}
      <label>Reference <input type="file" accept="image/*" onChange={e => { if (photo) URL.revokeObjectURL(photo); if (e.target.files?.[0]) setPhoto(URL.createObjectURL(e.target.files[0])); }} /></label>
      <button onClick={() => { const a = document.createElement("a"); a.download = "rootsight-render.png"; a.href = document.querySelector("canvas")!.toDataURL("image/png"); a.click(); }}>Save render</button><p role="alert">{error}</p></header>}
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      <div id="render" style={{ width: capture ? "100vw" : 390, height: capture ? "100vh" : 600 }}>
        <SceneCanvas profile={scan} mode={mode} months={months} conditions={conditions} roots={params.has("roots") || params.has("cutaway")}><Probe /></SceneCanvas>
      </div>
      {photo && <img alt="Local reference plant" src={photo} style={{ width: 390, height: 600, objectFit: "contain" }} />}
    </div>
  </main>;
}

// Not linked by the application; Vite's production build does not include this entry point.
if (import.meta.env.DEV) createRoot(document.getElementById("root")!).render(<Lab />);
