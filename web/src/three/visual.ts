import type { PlantProfile } from "@rootsight/shared/schema";

/** Renderer bridge until the shared schema owner adds the optional visual contract. */
export type Visual = {
  seed: string;
  silhouette: { widthToHeight: number; leanDeg: number; leanDirectionDeg: number; symmetry: number };
  stems: { count: number; thicknessCm: number; internodeCm: number; tipColor: string };
  leaves: {
    widthToLength: number; sizeVariation: number; tip: "pointed" | "rounded";
    base: "tapered" | "heart" | "rounded"; edge: "smooth" | "serrated" | "lobed";
    fenestration: number; curl: number; twist: number; gloss: number; undersideColor: string;
    arrangement: "alternate" | "opposite" | "whorled" | "rosette"; droop: number;
    variegation: "none" | "marbled" | "sectoral" | "margin" | "striped";
    variegationAmount: number; variegationColor: string;
  };
  cactus: { form: "globe" | "column" | "pads" | "rosette"; ribs: number; spineDensity: number; spineColor: string; offsets: number };
  condition: { yellowing: number; brownTips: number; legginess: number };
  pot: { color: string; material: "terracotta" | "ceramic" | "plastic" | "none"; diameterToHeight: number; heightToDiameter: number; soilVisible: boolean };
};
export type VisualInput = { seed?: string } & { [K in Exclude<keyof Visual, "seed">]?: Partial<Visual[K]> };
export type RenderProfile = Omit<PlantProfile, "visual"> & { visual?: unknown };
export type VisualProfile = Omit<PlantProfile, "visual"> & { visual?: VisualInput };

const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const num = (v: unknown, fallback: number, min: number, max: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const color = (v: unknown, fallback: string) => typeof v === "string" && /^#[\da-f]{6}$/i.test(v) ? v : fallback;
function choice<T extends string>(v: unknown, fallback: T, choices: readonly T[]): T { return choices.includes(v as T) ? v as T : fallback; }

/** Missing, null, malformed and future unknown fields all have safe, finite fallbacks. */
export function visualOf(p: RenderProfile): Visual {
  const m = p.morphology, l = m.leaf;
  const raw = obj(p.visual);
  const s = obj(raw.silhouette), st = obj(raw.stems), a = obj(raw.leaves), c = obj(raw.cactus ?? raw.succulent), co = obj(raw.condition), pot = obj(raw.pot);
  const cactus = l.countNow === 0 && (m.growthForm === "succulent" || l.shape === "needle");
  const strap = m.growthForm === "grass";
  const succulent = m.growthForm === "succulent" && !cactus;
  const aroid = l.shape === "fenestrated" || (m.growthForm === "rosette" && !succulent && !strap);
  const ratio = l.shape === "needle" ? 0.07 : l.shape === "lanceolate" ? 0.2 : l.shape === "round" ? 0.95 : aroid ? 0.8 : 0.58;
  const defaultStemCount = strap || succulent ? 1 : aroid ? 2 : m.growthForm === "tree" ? 1 : 3;
  return {
    // Deliberately exclude mutable visual refinements from the fallback seed to avoid reshuffling.
    seed: typeof raw.seed === "string" && raw.seed.length ? raw.seed.slice(0, 128) : `${p.species.scientificName}:${m.currentHeightCm}:${l.countNow}`,
    silhouette: { widthToHeight: num(s.widthToHeight, cactus ? 1.1 : strap ? 0.6 : aroid ? 1.1 : 0.9, 0.15, 3), leanDeg: num(s.leanDeg, 0, 0, 65), leanDirectionDeg: num(s.leanDirectionDeg, ({ right: 34, left: 214, toward: 124, away: 304 } as Record<string, number>)[String(s.leanDirection)] ?? 0, 0, 360), symmetry: num(s.symmetry, 0.75, 0, 1) },
    stems: { count: Math.round(num(st.count ?? st.countFromSoil, defaultStemCount, 1, 12)), thicknessCm: num(st.thicknessCm ?? (typeof st.thicknessMm === "number" ? st.thicknessMm / 10 : undefined), aroid ? 0.7 : strap ? 0.1 : m.growthForm === "tree" ? 1.2 : 0.25, 0.03, 10), internodeCm: num(st.internodeCm, m.currentHeightCm / 5, 0.2, 60), tipColor: color(st.tipColor, m.stemColor) },
    leaves: {
      widthToLength: num(a.widthToLength, ratio, 0.03, 1.5), sizeVariation: num(a.sizeVariation, 0.25, 0, 0.8),
      tip: choice(a.tip, "pointed", ["pointed", "rounded"]), base: choice(a.base, aroid ? "heart" : "tapered", ["tapered", "heart", "rounded"]),
      edge: choice(a.edge, l.shape === "palmate" ? "lobed" : "smooth", ["smooth", "serrated", "lobed"]), fenestration: num(a.fenestration, l.shape === "fenestrated" ? 0.6 : 0, 0, 1),
      curl: num(a.curl, succulent ? 0.45 : 0.18, -1, 1), twist: num(a.twist, 0.12, -1, 1), gloss: num(a.gloss, aroid ? 0.55 : 0.25, 0, 1),
      undersideColor: color(a.undersideColor ?? a.colorUnder, "#7b985e"), arrangement: choice(a.arrangement === "basal" ? "rosette" : a.arrangement, aroid || strap || succulent ? "rosette" : m.growthForm === "vine" || m.growthForm === "tree" ? "alternate" : "opposite", ["alternate", "opposite", "whorled", "rosette"]), droop: num(a.droop, 0.15, 0, 1),
      variegation: choice(({ streaks: "striped", patches: "sectoral", speckled: "marbled" } as Record<string, string>)[String(a.variegation)] ?? a.variegation, "none", ["none", "marbled", "sectoral", "margin", "striped"]), variegationAmount: num(a.variegationAmount, a.variegation && a.variegation !== "none" ? 0.35 : 0, 0, 1), variegationColor: color(a.variegationColor, "#ddd9a8"),
    },
    cactus: { form: choice(c.form ?? c.bodyForm, succulent ? "rosette" : m.matureHeightCm > 100 ? "column" : "globe", ["globe", "column", "pads", "rosette"]), ribs: Math.round(num(c.ribs ?? c.ribCount, 20, 5, 32)), spineDensity: num(c.spineDensity, 0.65, 0, 1), spineColor: color(c.spineColor, l.color), offsets: Math.round(num(c.offsets, 0, 0, 6)) },
    condition: { yellowing: num(co.yellowing, 0, 0, 1), brownTips: num(co.brownTips, 0, 0, 1), legginess: num(co.legginess ?? s.legginess, 0, 0, 1) },
    pot: { color: color(pot.color, "#b96743"), material: choice(pot.material, "terracotta", ["terracotta", "ceramic", "plastic", "none"]), diameterToHeight: num(pot.diameterToHeight ?? (typeof pot.diameterCm === "number" ? pot.diameterCm / m.currentHeightCm : undefined), cactus ? 1.5 : aroid ? 0.43 : strap ? 0.42 : 0.65, 0.1, 3), heightToDiameter: num(pot.heightToDiameter, 0.85, 0.3, 1.5), soilVisible: typeof pot.soilVisible === "boolean" ? pot.soilVisible : true },
  };
}

/** Pot stays the photographed size through growth; it does not auto-repot from inferred roots. */
export function potDimensions(p: RenderProfile) {
  const v = visualOf(p);
  const radius = v.pot.material === "none" ? 0 : p.morphology.currentHeightCm / 200 * v.pot.diameterToHeight;
  return { radius, depth: radius * 2 * v.pot.heightToDiameter };
}
