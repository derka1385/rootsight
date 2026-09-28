import { Vector3 } from "three";
import type { BloomObservation, PlantState } from "@rootsight/shared/schema";
import { architectureOf, foliageExtent, LAYER_DEPTH, occupancyOf, photoFrame, sampleFoliage, TOWARD } from "./architecture";
import { seededRandom } from "./procedural";
import type { StemPath } from "./StemGeometry";
import type { RenderProfile as PlantProfile, Visual } from "./visual";

/*
 * Flower generator (layout half). Flowers, buds and fruits come from the photo inventory
 * (individual.blooms): each observed landmark is placed where the photo shows it, the rest of the counted
 * organs are placed where this kind of plant carries them (above the leaves, at stem tips, among or under
 * the foliage), clustered the way the species flowers (species.flowering). Nothing is invented: a photo
 * without flowers renders none. Pure and deterministic, like the leaf layout.
 */

export type BloomKind = BloomObservation["kind"];
/**
 * One flower (or floret), bud or fruit: its centre, the way its face points, its diameter in metres and
 * the point where its stalk joins it (behind the petals, at the back of a bud, the top of a fruit).
 */
export type BloomOrgan = { id: string; kind: BloomKind; position: Vector3; facing: Vector3; size: number; base: Vector3 };

/** How far behind an organ's centre its stalk attaches, as a fraction of its size (inside the organ: no gap). */
export const ATTACH: Record<BloomKind, number> = { flower: 0.14, bud: 0.58, fruit: 0.45 };
export type BloomLayout = { organs: BloomOrgan[]; stalks: StemPath[] };

/** Organs drawn one by one; larger inventories draw their clusters a little denser instead. */
export const MAX_BLOOMS = 240;
const UP = new Vector3(0, 1, 0);
const GOLDEN = 2.399963;
const EMPTY: BloomLayout = { organs: [], stalks: [] };

type Cluster = { id: string; kind: BloomKind; x: number; y: number; depth: number; florets: number; facing: BloomObservation["facing"] };

/**
 * The organ's face direction: away from the plant's axis, turned toward the camera by `toCamera` (the
 * photo saw these organs from there, so they present to the viewer as in the photo, never to the wall).
 */
function facingVector(facing: BloomObservation["facing"], position: Vector3, random: () => number, toCamera: number) {
  const out = new Vector3(position.x, 0, position.z);
  if (out.lengthSq() < 1e-8) out.set(Math.sin(random() * 6.28), 0, Math.cos(random() * 6.28));
  out.normalize().multiplyScalar(1 - toCamera).addScaledVector(TOWARD, toCamera);
  if (out.lengthSq() < 1e-4) out.copy(TOWARD);
  out.normalize();
  const up = facing === "up" ? 0.85 : facing === "out" ? 0.3 : -0.8;
  return out.multiplyScalar(Math.sqrt(1 - up * up)).addScaledVector(UP, up).normalize();
}

export function bloomLayout(p: PlantProfile, state: PlantState, v: Visual): BloomLayout {
  const inv = p.individual?.blooms;
  if (!inv || inv.flowers + inv.buds + inv.fruits === 0) return EMPTY;
  const flowering = v.botanical.flowering;
  const frame = photoFrame(p, state, v);
  const grid = occupancyOf(p);
  const rosette = architectureOf(p, v) === "aroid" || architectureOf(p, v) === "grass";
  const random = seededRandom(`${v.seed}:blooms`);

  // Where the foliage ends: the highest row with real leaf cover (flowers held above it sit higher).
  const foliageTop = grid ? foliageExtent(grid).top : 0.8;
  const topRow = Math.round((1 - foliageTop) * 8);
  const topCols = grid ? grid.slice(Math.max(0, topRow), Math.max(0, topRow) + 2).flatMap(row => row.map((w, c) => (w >= 0.3 ? c : -1))).filter(c => c >= 0) : [];
  const spanLeft = topCols.length ? (Math.min(...topCols) / 8) * 2 - 1 : -0.6, spanRight = topCols.length ? ((Math.max(...topCols) + 1) / 8) * 2 - 1 : 0.6;

  const landmarks: Cluster[] = [...inv.landmarks].sort((a, b) => a.id.localeCompare(b.id))
    .map(l => ({ id: l.id, kind: l.kind, x: l.x, y: l.y, depth: LAYER_DEPTH[l.layer], florets: l.florets, facing: l.facing }));
  const defaultFacing = (kind: BloomKind): BloomObservation["facing"] => {
    const votes = landmarks.filter(l => l.kind === kind).map(l => l.facing);
    if (votes.length) return (["up", "out", "down"] as const).reduce((best, f) => (votes.filter(x => x === f).length > votes.filter(x => x === best).length ? f : best), votes[0]);
    if (kind !== "flower") return kind === "fruit" ? "out" : "up";
    return flowering.form === "reflexed" || flowering.form === "bell" ? "down" : flowering.form === "spathe" ? "out" : "up";
  };

  // Counted organs the landmarks do not account for are placed as extra heads or clusters.
  const clusters = [...landmarks];
  const counts: Record<BloomKind, number> = { flower: inv.flowers, bud: inv.buds, fruit: inv.fruits };
  const perCluster = (kind: BloomKind) => {
    const sizes = landmarks.filter(l => l.kind === kind && l.florets > 1).map(l => l.florets);
    if (sizes.length) return Math.max(2, Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length));
    return flowering.inflorescence === "solitary" || flowering.inflorescence === "spadix" || kind === "fruit" ? 1 : flowering.inflorescence === "spike" ? 10 : 8;
  };
  const place = (kind: BloomKind, k: number): Omit<Cluster, "id" | "kind" | "florets" | "facing"> => {
    const r = seededRandom(`${v.seed}:bloom:${kind}:${k}`);
    // Best of a few candidates: extra heads spread out instead of piling up.
    let best = { x: 0, y: foliageTop, depth: 0 }, bestGap = -1;
    for (let tries = 0; tries < 8; tries++) {
      let c: { x: number; y: number; depth: number };
      if (inv.placement === "among-foliage" || inv.placement === "axillary") {
        const s = grid ? sampleFoliage(grid, r, 0.9) : { x: r() * 1.6 - 0.8, y: 0.3 + r() * 0.6, depth: r() * 2 - 1 };
        c = { ...s, depth: Math.sign(s.depth || 1) * Math.max(0.5, Math.abs(s.depth)) };
      } else if (inv.placement === "basal") c = { x: r() * 1 - 0.5, y: 0.05 + r() * 0.2, depth: r() * 1.4 - 0.7 };
      else c = { x: spanLeft + (spanRight - spanLeft) * (0.08 + 0.84 * r()), y: Math.min(0.98, Math.max(0.35, foliageTop - 0.04) + r() * Math.max(0.05, 1 - foliageTop)), depth: r() * 1.6 - 0.8 };
      const gap = Math.min(...clusters.map(o => Math.hypot(o.x - c.x, (o.y - c.y) * 1.5, (o.depth - c.depth) * 0.5)), 9);
      if (gap > bestGap) { best = c; bestGap = gap; }
    }
    return best;
  };
  for (const kind of ["flower", "bud", "fruit"] as const) {
    const left = counts[kind] - landmarks.filter(l => l.kind === kind).reduce((t, l) => t + l.florets, 0);
    const each = perCluster(kind);
    for (let k = 0; k < Math.ceil(Math.max(0, left) / each) && clusters.length < 60; k++) {
      clusters.push({ id: `${kind}-extra-${k}`, kind, florets: Math.min(each, left - k * each), facing: defaultFacing(kind), ...place(kind, k) });
    }
  }

  // Florets: a cluster opens into a small dome (or a spike) of heads around its centre.
  const florets = clusters.reduce((t, c) => t + c.florets, 0);
  const thin = Math.min(1, MAX_BLOOMS / Math.max(1, florets));
  const organs: BloomOrgan[] = [], stalks: StemPath[] = [];
  const flowerSize = inv.flowerDiameterCm / 100, fruitSize = inv.fruitDiameterCm / 100;
  const sizeOf = (kind: BloomKind) => (kind === "fruit" ? fruitSize : kind === "bud" ? flowerSize * 0.42 : flowerSize) * Math.pow(frame.growth, 0.1);
  const stalkLength = Math.max(0.01, inv.stalkCm / 100);
  for (const c of clusters) {
    const rc = seededRandom(`${v.seed}:cluster:${c.id}`);
    const centre = frame.at(c.x, c.y, c.depth);
    const facing = facingVector(c.facing, centre, rc, c.id.includes("-extra-") ? 0.35 : 0.65);
    // Drought: heads nod and hang first.
    facing.lerp(new Vector3(facing.x, -1, facing.z), state.wilt * 0.6).normalize();
    const size = sizeOf(c.kind);
    const n = Math.max(1, Math.round(c.florets * thin));
    // Peduncle: rosettes raise their flowers from the crown; stems carry theirs a stalk's length below.
    const anchor = rosette
      ? new Vector3(centre.x * 0.15, 0.005, centre.z * 0.15)
      : new Vector3(centre.x * 0.55, Math.max(0.005, centre.y - stalkLength), centre.z * 0.55);
    // Organs first (their final size decides where the stalk must end), then the stalks that carry them.
    const members: BloomOrgan[] = [];
    for (let f = 0; f < n; f++) {
      let position = centre.clone(), face = facing.clone();
      if (n > 1) {
        // Florets on a spherical cap around the cluster axis, each facing a little outward.
        const side = new Vector3().crossVectors(facing, Math.abs(facing.y) > 0.9 ? new Vector3(1, 0, 0) : UP).normalize();
        const other = new Vector3().crossVectors(facing, side);
        const spike = flowering.inflorescence === "spike";
        const t = (f + 0.5) / n, a = f * GOLDEN;
        const capR = size * 0.55 * Math.sqrt(n);
        const radial = spike ? size * 0.45 : capR * Math.sqrt(t);
        const lift = spike ? (t - 0.5) * size * n * 0.55 : -capR * 0.35 * t;
        const out = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(other, Math.sin(a));
        position = centre.clone().addScaledVector(out, radial).addScaledVector(spike ? UP : facing, lift);
        face = facing.clone().lerp(out, spike ? 0.8 : 0.45).normalize();
      }
      const organSize = size * (0.9 + rc() * 0.2);
      members.push({ id: n > 1 ? `${c.id}-${f}` : c.id, kind: c.kind, position, facing: face, size: organSize, base: position.clone().addScaledVector(face, -organSize * ATTACH[c.kind]) });
    }
    // The stalk ends exactly where the organ (or the cluster's node) begins, entering along its axis.
    const end = n > 1 ? centre.clone().addScaledVector(facing, -size * 0.6) : members[0].base;
    const into = end.clone().addScaledVector(facing, -size * 0.35);
    const nodding = facing.y < -0.2;
    // A nodding head hangs from a stalk that rises past it and arches over; others meet it from below.
    const crest = nodding ? into.clone().add(new Vector3(0, size * 0.6, 0)).addScaledVector(new Vector3(anchor.x - into.x, 0, anchor.z - into.z), 0.15) : anchor.clone().lerp(into, 0.6).add(new Vector3(0, size * 0.2, 0));
    const stalkRadius = Math.min(0.004, Math.max(0.0009, size * 0.035 * Math.sqrt(n)));
    stalks.push({ id: `stalk-${c.id}`, points: [anchor, anchor.clone().lerp(crest, 0.55).add(new Vector3(0, (crest.y - anchor.y) * 0.08, 0)), crest, into, end], radius: stalkRadius, taper: 0.3, depth: 3 });
    if (n > 1) for (const m of members) {
      stalks.push({ id: `pedicel-${m.id}`, points: [end, end.clone().lerp(m.base, 0.5).addScaledVector(facing, size * 0.1), m.base.clone().addScaledVector(m.facing, -m.size * 0.2), m.base], radius: stalkRadius * 0.45, taper: 0.25, depth: 4 });
    }
    organs.push(...members);
  }
  return { organs, stalks };
}
