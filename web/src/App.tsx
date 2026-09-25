import { useMemo, useState } from "react";
import type { ImageInput, PlantProfile } from "@rootsight/shared/schema";
import { simulate } from "@rootsight/shared/simulation";
import { fixtures } from "@rootsight/shared/fixtures";
import * as api from "./api";
import PhotoUpload from "./components/PhotoUpload";
import PlantInfoPanel from "./components/PlantInfoPanel";
import Controls from "./components/Controls";
import SceneCanvas from "./components/SceneCanvas";

// TODO(ui-owner): capture via the R3F gl ref instead of querying the DOM.
function screenshotCanvas(): ImageInput {
  const url = document.querySelector("canvas")!.toDataURL("image/jpeg", 0.85);
  return { imageBase64: url.split(",")[1], mediaType: "image/jpeg" };
}

export default function App() {
  const [profile, setProfile] = useState<PlantProfile>(fixtures.monstera);
  const [photo, setPhoto] = useState<ImageInput | null>(null);
  const [month, setMonth] = useState(0);
  const [waterIntervalDays, setWaterIntervalDays] = useState(profile.care.waterIntervalDays);
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const state = useMemo(() => simulate(profile, month, waterIntervalDays), [profile, month, waterIntervalDays]);

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

  const onPhoto = (img: ImageInput) =>
    run("Identifying plant…", async () => {
      setPhoto(img);
      const p = await api.analyze(img);
      setProfile(p);
      setWaterIntervalDays(p.care.waterIntervalDays);
      setMonth(0);
      setExplanation("");
    });

  const onWhatIf = (question: string) =>
    run("Thinking about it…", async () => {
      const r = await api.whatIf(profile, question);
      setProfile(r.profile);
      setExplanation(r.explanation);
    });

  const onRefine = () =>
    run("Comparing render to photo…", async () => {
      setProfile(await api.refine(photo!, screenshotCanvas(), profile));
    });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gridTemplateRows: "1fr auto", height: "100%" }}>
      <aside style={{ overflowY: "auto", padding: 16, borderRight: "1px solid #253029" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>Rootsight</h1>
        <p style={{ margin: "0 0 16px", opacity: 0.7 }}>Take a photo of your plant and see its future.</p>
        <PhotoUpload onPhoto={onPhoto} disabled={!!busy} />
        {busy && <p>{busy}</p>}
        {error && <p style={{ color: "#ff8a80" }}>{error}</p>}
        <PlantInfoPanel profile={profile} state={state} />
      </aside>
      <main style={{ minHeight: 0 }}>
        <SceneCanvas state={state} profile={profile} />
      </main>
      <footer style={{ gridColumn: "1 / -1", padding: 12, borderTop: "1px solid #253029" }}>
        <Controls
          month={month}
          onMonth={setMonth}
          waterIntervalDays={waterIntervalDays}
          onWaterIntervalDays={setWaterIntervalDays}
          onWhatIf={onWhatIf}
          onRefine={onRefine}
          canRefine={!!photo && !busy}
          busy={!!busy}
          explanation={explanation}
        />
      </footer>
    </div>
  );
}
