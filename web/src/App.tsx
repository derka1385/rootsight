import { useState } from "react";
import type { ImageInput, PlantProfile } from "@rootsight/shared/schema";
import * as api from "./api";
import { useMyPlants, type SavedPlant } from "./myPlants";
import { useAccount } from "./account";
import Home from "./components/Home";
import Scan from "./components/Scan";
import Account from "./components/Account";
import PlantDetail from "./components/PlantDetail";
import { HomeIcon, ScanIcon, UserIcon } from "./components/icons";

function screenshotCanvas(): ImageInput {
  const url = document.querySelector("canvas")!.toDataURL("image/jpeg", 0.85);
  return { imageBase64: url.split(",")[1], mediaType: "image/jpeg" };
}

type Tab = "home" | "scan" | "account";
/** The plant open in the detail screen; savedId links it to the garden. */
type Open = { profile: PlantProfile; savedId: string | null; photo: ImageInput | null };

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const myPlants = useMyPlants();
  const [account, setAccount] = useAccount();

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

  const show = (o: Open) => {
    setOpen(o);
    setExplanation("");
    setError("");
  };
  const openSaved = (p: SavedPlant) => show({ profile: p.profile, savedId: p.id, photo: null });
  const openSample = (profile: PlantProfile) => show({ profile, savedId: null, photo: null });

  const onPhoto = (img: ImageInput) =>
    run("Identifying your plant…", async () => {
      show({ profile: await api.analyze(img), savedId: null, photo: img });
    });

  const saved = open?.savedId ? (myPlants.plants.find((p) => p.id === open.savedId) ?? null) : null;

  return (
    <div className="app">
      {tab === "home" && (
        <Home name={account.name} reminders={account.reminders} myPlants={myPlants} onOpenSaved={openSaved} onOpenSample={openSample} onScan={() => setTab("scan")} />
      )}
      {tab === "scan" && <Scan busy={open ? null : busy} error={open ? "" : error} onPhoto={onPhoto} onSample={openSample} />}
      {tab === "account" && <Account account={account} onChange={setAccount} myPlants={myPlants} />}

      <nav className="tabbar" aria-label="Main">
        <button aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><HomeIcon />Home</button>
        <button className="scan-tab" aria-current={tab === "scan" ? "page" : undefined} onClick={() => setTab("scan")}><span className="bubble"><ScanIcon /></span>Scan</button>
        <button aria-current={tab === "account" ? "page" : undefined} onClick={() => setTab("account")}><UserIcon />Account</button>
      </nav>

      {open && (
        <PlantDetail
          key={open.profile.species.scientificName + (open.savedId ?? "")}
          profile={open.profile}
          saved={saved}
          busy={busy}
          error={error}
          explanation={explanation}
          canRefine={!!open.photo && !busy}
          onBack={() => setOpen(null)}
          onSave={() => {
            const id = myPlants.add(open.profile);
            setOpen({ ...open, savedId: id });
          }}
          onWater={() => saved && myPlants.water(saved.id)}
          onWhatIf={(question) =>
            run("Thinking about it…", async () => {
              const r = await api.whatIf(open.profile, question);
              setOpen((o) => o && { ...o, profile: r.profile });
              setExplanation(r.explanation);
            })
          }
          onRefine={() =>
            run("Comparing the 3D with your photo…", async () => {
              const profile = await api.refine(open.photo!, screenshotCanvas(), open.profile);
              setOpen((o) => o && { ...o, profile });
            })
          }
        />
      )}
    </div>
  );
}
