import { useState } from "react";
import type { GrowthConditions, ImageInput, PlantScan } from "@rootsight/shared/schema";
import { defaultConditions } from "@rootsight/shared/simulation";
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

/** A small JPEG of the scanned photo, kept with the saved plant so the Scanned view can show it. */
async function thumbnail(photo: ImageInput, side = 320): Promise<string> {
  const img = new Image();
  img.src = `data:${photo.mediaType};base64,${photo.imageBase64}`;
  await img.decode();
  const scale = Math.min(1, side / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

type Tab = "home" | "scan" | "account";
/** The plant open in the detail screen; savedId links it to the garden. */
type Open = {
  scan: PlantScan;
  savedId: string | null;
  /** The photo it was scanned from (this session only; refine needs it at full size). */
  photo: ImageInput | null;
  photoUrl: string | null;
  conditions: GrowthConditions;
  explanation: string;
  corrections: string[];
};

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
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

  const show = (scan: PlantScan, savedId: string | null, photo: ImageInput | null, photoUrl: string | null) => {
    setOpen({ scan, savedId, photo, photoUrl, conditions: defaultConditions(scan), explanation: "", corrections: [] });
    setError("");
  };
  const openSaved = (p: SavedPlant) => show(p.scan, p.id, null, p.photoThumb ?? null);
  const openSample = (scan: PlantScan) => show(scan, null, null, null);

  const onPhoto = (img: ImageInput) =>
    run("Reading your plant…", async () => {
      show(await api.analyze(img), null, img, `data:${img.mediaType};base64,${img.imageBase64}`);
    });

  /** Keep the open scan and its saved copy in sync (refine and what-if improve the scan). */
  const updateScan = (scan: PlantScan, patch: Partial<Open> = {}) => {
    setOpen((o) => o && { ...o, ...patch, scan });
    if (open?.savedId) myPlants.update(open.savedId, scan);
  };

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
          key={open.scan.profile.species.scientificName + (open.savedId ?? "")}
          scan={open.scan}
          photoUrl={open.photoUrl}
          saved={saved}
          busy={busy}
          error={error}
          explanation={open.explanation}
          corrections={open.corrections}
          conditions={open.conditions}
          onConditions={(conditions) => setOpen((o) => o && { ...o, conditions })}
          canRefine={!!open.photo && !busy}
          onBack={() => setOpen(null)}
          onSave={async () => {
            const id = myPlants.add(open.scan, open.photo ? await thumbnail(open.photo) : undefined);
            setOpen((o) => o && { ...o, savedId: id });
          }}
          onWater={() => saved && myPlants.water(saved.id)}
          onWhatIf={(question) =>
            run("Thinking about it…", async () => {
              const r = await api.whatIf(open.scan, open.conditions, question);
              updateScan({ ...open.scan, growth: r.growth }, { conditions: r.conditions, explanation: r.explanation });
            })
          }
          onRefine={() =>
            run("Comparing the 3D with your photo…", async () => {
              const r = await api.refine(open.photo!, screenshotCanvas(), open.scan);
              updateScan(r.scan, { corrections: r.corrections });
            })
          }
        />
      )}
    </div>
  );
}
