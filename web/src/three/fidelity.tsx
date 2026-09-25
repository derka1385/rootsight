import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import { PlantProfile } from "@rootsight/shared/schema";
import { fixtures } from "@rootsight/shared/fixtures";
import { simulate } from "@rootsight/shared/simulation";
import SceneCanvas from "../components/SceneCanvas";
import { photoProfiles, architectureProfiles } from "./photoProfiles";
import type { RenderProfile } from "./visual";

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
  const catalog: Record<string, RenderProfile> = { ...fixtures, ...photoProfiles, ...architectureProfiles };
  const [profile, setProfile] = useState<RenderProfile>(catalog[params.get("profile") ?? "monstera"] ?? fixtures.monstera);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState("");
  const { visual: _visual, ...simulationProfile } = profile;
  const state = simulate(simulationProfile, Number(params.get("month") ?? 0), Number(params.get("water") ?? profile.care.waterIntervalDays));
  const capture = params.has("capture");
  return <main style={{ fontFamily: "system-ui", background: "#f4efe7", minHeight: "100vh" }}>
    {!capture && <header style={{ padding: 16 }}><h1>Photo fidelity lab</h1><p>Choose a profile or load JSON with an optional visual block. Reference photos stay in your browser.</p>
      <label>Profile <select value={params.get("profile") ?? "monstera"} onChange={e => { location.search = `?profile=${e.target.value}`; }}>{Object.keys(catalog).map(k => <option key={k}>{k}</option>)}</select></label>{" "}
      <label>JSON <input type="file" accept="application/json" onChange={async e => { try { const value = JSON.parse(await e.target.files![0].text()); const { visual, ...base } = value; setProfile({ ...PlantProfile.parse(base), visual }); setError(""); } catch (err) { setError(String(err)); } }} /></label>{" "}
      <label>Reference <input type="file" accept="image/*" onChange={e => { if (photo) URL.revokeObjectURL(photo); if (e.target.files?.[0]) setPhoto(URL.createObjectURL(e.target.files[0])); }} /></label>
      <button onClick={() => { const a = document.createElement("a"); a.download = "rootsight-render.png"; a.href = document.querySelector("canvas")!.toDataURL("image/png"); a.click(); }}>Save render</button><p role="alert">{error}</p></header>}
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      <div id="render" style={{ width: capture ? "100vw" : 390, height: capture ? "100vh" : 600 }}>
        <SceneCanvas state={state} profile={profile} cutaway={params.has("cutaway")}><Probe /></SceneCanvas>
      </div>
      {photo && <img alt="Local reference plant" src={photo} style={{ width: 390, height: 600, objectFit: "contain" }} />}
    </div>
  </main>;
}

// Not linked by the application; Vite's production build does not include this entry point.
if (import.meta.env.DEV) createRoot(document.getElementById("root")!).render(<Lab />);
