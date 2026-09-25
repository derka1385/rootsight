import { useState } from "react";

type Props = {
  month: number;
  onMonth: (m: number) => void;
  waterIntervalDays: number;
  onWaterIntervalDays: (d: number) => void;
  onWhatIf: (question: string) => void;
  onRefine: () => void;
  canRefine: boolean;
  busy: boolean;
  explanation: string;
};

// TODO(ui-owner): play button that animates the month slider, what-if suggestion chips.
export default function Controls(p: Props) {
  const [question, setQuestion] = useState("What if I water every 2 weeks?");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
      <label>
        Month {p.month}
        <br />
        <input type="range" min={0} max={24} value={p.month} onChange={(e) => p.onMonth(+e.target.value)} />
      </label>
      <label>
        Water every {p.waterIntervalDays} days
        <br />
        <input
          type="range"
          min={1}
          max={60}
          value={p.waterIntervalDays}
          onChange={(e) => p.onWaterIntervalDays(+e.target.value)}
        />
      </label>
      <form
        style={{ display: "flex", gap: 8, flex: 1, minWidth: 280 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) p.onWhatIf(question.trim());
        }}
      >
        <input style={{ flex: 1 }} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button disabled={p.busy}>Ask</button>
      </form>
      <button onClick={p.onRefine} disabled={!p.canRefine} title={p.canRefine ? "Screenshot the render and let Claude correct it" : "Upload a photo first"}>
        🔁 Refine render
      </button>
      {p.explanation && <p style={{ flexBasis: "100%", margin: 0 }}>{p.explanation}</p>}
    </div>
  );
}
