import { useMemo, useState } from "react";
import type { ImageInput, PlantProfile } from "@rootsight/shared/schema";
import { simulate } from "@rootsight/shared/simulation";
import { fixtures } from "@rootsight/shared/fixtures";
import * as api from "./api";
import { useMyPlants } from "./myPlants";
import PhotoUpload from "./components/PhotoUpload";
import PlantInfoPanel from "./components/PlantInfoPanel";
import Controls from "./components/Controls";
import SceneCanvas from "./components/SceneCanvas";
import MyPlants from "./components/MyPlants";
import Discover from "./components/Discover";

// TODO(ui-owner): capture via the R3F gl ref instead of querying the DOM.
function screenshotCanvas(): ImageInput {
  const url = document.querySelector("canvas")!.toDataURL("image/jpeg", 0.85);
  return { imageBase64: url.split(",")[1], mediaType: "image/jpeg" };
}

const TABS = [
  ["plant", "🪴 Plant"],
  ["mine", "🌿 My plants"],
  ["discover", "🔍 Discover"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function App() {
  const [tab, setTab] = useState<Tab>("plant");
  const [profile, setProfile] = useState<PlantProfile>(fixtures.monstera);
  const [photo, setPhoto] = useState<ImageInput | null>(null);
  const [month, setMonth] = useState(0);
  const [waterIntervalDays, setWaterIntervalDays] = useState(profile.care.waterIntervalDays);
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const myPlants = useMyPlants();

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

  function open(p: PlantProfile) {
    setProfile(p);
    setPhoto(null);
    setWaterIntervalDays(p.care.waterIntervalDays);
    setMonth(0);
    setExplanation("");
    setTab("plant");
  }

  const onPhoto = (img: ImageInput) =>
    run("Identifying plant…", async () => {
      open(await api.analyze(img));
      setPhoto(img);
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

  const saved = myPlants.plants.some((p) => p.profile === profile);

  return (
    <div className="app">
      {tab === "plant" && (
        <>
          <div style={{ height: "45%", flexShrink: 0 }}>
            <SceneCanvas state={state} profile={profile} />
          </div>
          <div className="scroll">
            <PhotoUpload onPhoto={onPhoto} disabled={!!busy} />
            {busy && <p>{busy}</p>}
            {error && <p style={{ color: "#ff8a80" }}>{error}</p>}
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
            <p>
              <button disabled={saved} onClick={() => myPlants.add(profile)}>
                {saved ? "✓ In my plants" : "＋ Save to my plants"}
              </button>
            </p>
            <PlantInfoPanel key={profile.species.scientificName} profile={profile} state={state} waterIntervalDays={waterIntervalDays} />
          </div>
        </>
      )}
      {tab === "mine" && (
        <div className="scroll">
          <MyPlants myPlants={myPlants} onOpen={open} />
        </div>
      )}
      {tab === "discover" && (
        <div className="scroll">
          <Discover onOpen={open} />
        </div>
      )}
      <nav className="tabbar">
        {TABS.map(([id, label]) => (
          <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
