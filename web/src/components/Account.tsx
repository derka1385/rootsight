import { useState } from "react";
import type { Account as AccountData } from "../account";
import type { useMyPlants } from "../myPlants";
import { stateToday } from "../growth";
import { BellIcon, DownloadIcon, LeafIcon, LockIcon, SparkIcon, TrashIcon } from "./icons";

type Props = { account: AccountData; onChange: (patch: Partial<AccountData>) => void; myPlants: ReturnType<typeof useMyPlants> };

export default function Account({ account, onChange, myPlants }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const plants = myPlants.plants;
  const mature = plants.filter((p) => stateToday(p).leafMaturity >= 0.75).length;
  const initials = account.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "🌱";

  const exportPlants = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(plants, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "rootsight-plants.json" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen">
      <div className="profile">
        <div className="avatar" aria-hidden="true">{initials}</div>
        <label className="sr-only" htmlFor="account-name">Your name</label>
        <input id="account-name" className="name-input" placeholder="Your name" value={account.name} onChange={(e) => onChange({ name: e.target.value })} />
        <p className="muted small" style={{ margin: 0 }}>Your garden is saved on this device</p>
      </div>

      <div className="summary">
        <div className="card"><b>{plants.length}</b><span className="small muted">plants</span></div>
        <div className="card"><b>{mature}</b><span className="small muted">mature</span></div>
        <div className="card"><b>{new Set(plants.map((p) => p.profile.identity.family)).size}</b><span className="small muted">families</span></div>
      </div>

      <h2 className="section-title">Preferences</h2>
      <div className="list">
        <div className="list-item">
          <span className="ico"><BellIcon /></span>
          <span className="grow">Watering reminders<br /><span className="small muted">Show thirsty plants on Home</span></span>
          <button className="switch" role="switch" aria-checked={account.reminders} aria-label="Watering reminders" onClick={() => onChange({ reminders: !account.reminders })} />
        </div>
        <div className="list-item">
          <span className="ico"><LockIcon /></span>
          <span className="grow">Sync across devices<br /><span className="small muted">Coming with the iPhone app</span></span>
        </div>
      </div>

      <h2 className="section-title">Your data</h2>
      <div className="list">
        <button className="list-item" onClick={exportPlants} disabled={!plants.length}>
          <span className="ico"><DownloadIcon /></span>
          <span className="grow">Export my garden (JSON)</span>
        </button>
        {!confirmClear ? (
          <button className="list-item danger" onClick={() => setConfirmClear(true)} disabled={!plants.length}>
            <span className="ico"><TrashIcon /></span>
            <span className="grow">Remove all plants</span>
          </button>
        ) : (
          <div className="list-item danger">
            <span className="ico"><TrashIcon /></span>
            <span className="grow">Remove {plants.length} plants for good?</span>
            <button className="btn ghost small" onClick={() => setConfirmClear(false)}>Cancel</button>
            <button className="btn small" style={{ background: "#b3361b" }} onClick={() => { plants.forEach((p) => myPlants.remove(p.id)); setConfirmClear(false); }}>Remove</button>
          </div>
        )}
      </div>

      <h2 className="section-title">About</h2>
      <div className="list">
        <div className="list-item"><span className="ico"><LeafIcon /></span><span className="grow">Rootsight<br /><span className="small muted">Take a photo of your plant and see its future.</span></span></div>
        <div className="list-item"><span className="ico"><SparkIcon /></span><span className="grow">Plant identification by Claude</span></div>
      </div>
    </div>
  );
}
