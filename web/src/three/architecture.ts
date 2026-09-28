import { CatmullRomCurve3, CubicBezierCurve3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "./visual";
import { seededRandom, smoothstep } from "./procedural";
import type { StemPath } from "./StemGeometry";
import { potDimensions, type Visual } from "./visual";

export type Archetype = "aroid" | "branching" | "cactus" | "vine" | "grass" | "succulent" | "tree";
export function architectureOf(p: PlantProfile, v: Visual): Archetype {
  if (p.morphology.growthForm === "succulent" && v.cactus.form === "rosette") return "succulent";
  return v.botanical.topology;
}
export type LeafOrgan = { id: string; parentId: string; birth: number; maturity: number; matrix: Matrix4; variant: number };
export type PlantLayout = { stems: Matrix4[]; stemPaths: StemPath[]; leaves: Matrix4[][]; organs: LeafOrgan[] };
const UP = new Vector3(0, 1, 0);
const GOLDEN = 2.399963;
/** Most blades one plant draws; also the instance capacity of each leaf age group. */
export const MAX_LEAVES = 400;

/** The default camera's azimuth: "photo left/right/toward" are relative to it. */
export const CAMERA_AZ = Math.atan2(1.6, 2.4);
const RIGHT = new Vector3(Math.cos(CAMERA_AZ), 0, -Math.sin(CAMERA_AZ));
export const TOWARD = new Vector3(Math.sin(CAMERA_AZ), 0, Math.cos(CAMERA_AZ));
export const LAYER_DEPTH = { foreground: 1, middle: 0, background: -1 } as const;

/**
 * The photo frame at a growth state. Observations use x in [-1, 1] across the half canopy width, y as a
 * fraction of plant height and depth in [-1, 1] from background to foreground. Observed organs keep their
 * place as the plant grows; the frame only widens gently (growth^0.3).
 */
export function photoFrame(p: PlantProfile, state: PlantState, v: Visual) {
  const initialH = p.morphology.currentHeightCm / 100;
  const growth = state.heightCm / 100 / initialH;
  const H = initialH * Math.pow(growth, 0.3), W = H * v.silhouette.widthToHeight;
  const depthToWidth = p.individual?.depthToWidth ?? 0.4;
  // In a photo the plant visibly starts at the pot rim (the soil is hidden): y = 0 is the rim, y = 1 the top.
  const rim = v.pot.material === "none" ? 0 : potDimensions(p).depth * 0.075;
  const at = (x: number, y: number, depth: number) =>
    RIGHT.clone().multiplyScalar(x * W / 2).addScaledVector(TOWARD, depth * W * depthToWidth / 2).setY(y * H + rim * (1 - Math.min(1, Math.max(0, y))));
  return { H, W, growth, depthToWidth, at };
}

/** The photographed foliage silhouette as 8×8 weights (top row first), or null when not observed. */
export function occupancyOf(p: PlantProfile): number[][] | null {
  const grid = p.individual?.occupancy?.map(row => [...row].map(c => Number(c) / 9));
  return grid && grid.flat().some(w => w > 0) ? grid : null;
}

/**
 * A deterministic point in the photographed foliage mass: a cell drawn by its occupancy, a position in it,
 * and a depth inside that row's elliptical cross-section. Dense canopies put leaves on the outer shell,
 * sparse ones spread them through the volume.
 */
export function sampleFoliage(grid: number[][], random: () => number, density: number) {
  const cells = grid.flat(), total = cells.reduce((a, b) => a + b, 0);
  let pick = random() * total, index = cells.length - 1;
  for (let i = 0; i < cells.length; i++) { pick -= cells[i]; if (pick <= 0 && cells[i] > 0) { index = i; break; } }
  while (cells[index] <= 0) index--; // float drift past the end
  const row = Math.floor(index / 8), col = index % 8;
  const x = ((col + random()) / 8) * 2 - 1, y = 1 - (row + random()) / 8;
  const filled = grid[row].map((w, c) => (w > 0.15 ? c : -1)).filter(c => c >= 0);
  const left = ((filled[0] ?? col) / 8) * 2 - 1, right = (((filled.at(-1) ?? col) + 1) / 8) * 2 - 1;
  const cx = (left + right) / 2, half = Math.max(0.125, (right - left) / 2);
  const reach = half * Math.sqrt(Math.max(0.05, 1 - ((x - cx) / half) ** 2));
  const u = random() * 2 - 1;
  const depth = Math.sign(u) * Math.pow(Math.abs(u), 1 - 0.6 * density) * reach;
  return { x, y, depth };
}

/** Top and bottom of the photographed foliage (fractions of plant height), from the occupancy rows. */
export function foliageExtent(grid: number[][]) {
  const rows = grid.map(row => Math.max(...row) >= 0.3);
  const top = rows.indexOf(true), bottom = rows.lastIndexOf(true);
  return top < 0 ? { top: 0.8, bottom: 0 } : { top: 1 - top / 8, bottom: 1 - (bottom + 1) / 8 };
}

/**
 * Outward normal of the photographed foliage mass at a sampled point, treating the canopy as an
 * ellipsoid over its occupancy extent. Leaves on a full canopy lie tangent to it, top face out; lower
 * leaves face outward rather than into the soil.
 */
function canopyNormal(grid: number[][], s: { x: number; y: number; depth: number }, W: number, H: number, depthToWidth: number) {
  // A dome standing on its base: upper leaves face the sky, side leaves face out.
  const { top, bottom } = foliageExtent(grid);
  const cy = bottom, halfY = Math.max(0.1, top - bottom);
  const X = s.x * W / 2, Y = (s.y - cy) * H, Z = s.depth * W * depthToWidth / 2;
  const ax = W / 2, by = halfY * H, cz = Math.max(0.01, W * depthToWidth / 2);
  const n = RIGHT.clone().multiplyScalar(X / (ax * ax)).addScaledVector(UP, Y / (by * by)).addScaledVector(TOWARD, Z / (cz * cz));
  if (n.lengthSq() < 1e-10) n.copy(UP);
  // Leaves turn their faces to the light: tilt every normal up a little.
  n.normalize().addScaledVector(UP, 0.5).normalize();
  if (n.y < -0.15) { n.y = -0.15; n.normalize(); }
  return n;
}

/** Blade orientation: local +z along the blade axis, local +y (top face) as close to `face` as possible. */
function bladeFrame(axis: Vector3, face: Vector3, roll: number) {
  const z = axis.clone().normalize();
  const y = face.clone().addScaledVector(z, -face.dot(z));
  if (y.lengthSq() < 1e-8) y.copy(UP).addScaledVector(z, -z.y);
  y.normalize();
  const x = new Vector3().crossVectors(y, z);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll));
}

/**
 * Leaves the photographed canopy needs to look as full as observed. Claude outlines the blades it can
 * resolve, which undercounts a bushy plant; this floor is the count that makes the observed foliage area
 * as opaque as its observed density (leaves overlap about 1.6 deep). Only for vision-observed plants.
 */
export function densityLeafFloor(p: PlantProfile, v: Visual): number {
  const density = p.individual?.crownDensity;
  if (density === undefined || p.morphology.leaf.countNow === 0) return 0;
  const H = p.morphology.currentHeightCm / 100, W = H * v.silhouette.widthToHeight;
  const grid = occupancyOf(p);
  const fill = grid ? grid.flat().reduce((a, b) => a + b, 0) / 64 : 0.55;
  const blade = (p.morphology.leaf.lengthCm / 100 * 0.8) ** 2 * v.leaves.widthToLength * 0.62;
  return Math.min(MAX_LEAVES, Math.round(Math.pow(density, 1.4) * 1.6 * W * H * fill / Math.max(1e-6, blade)));
}

/** Blade direction for an azimuth and a pitch from vertical (0 up, pi/2 horizontal, pi hanging). */
const bladeDirection = (az: number, pitch: number) => new Vector3(Math.sin(pitch) * Math.sin(az), Math.cos(pitch), Math.sin(pitch) * Math.cos(az));

/**
 * A grown, not drawn, centreline: a cubic Bézier from `a` to `b` that leaves `a` along `leave`, arrives
 * along `arrive` and can bow sideways a little. The same curve places the leaves and branches it carries,
 * so nothing attaches to a straight line the mesh no longer follows.
 */
export function smoothAxis(a: Vector3, b: Vector3, leave: Vector3, arrive: Vector3, bow = new Vector3()) {
  const L = a.distanceTo(b);
  const curve = new CubicBezierCurve3(a.clone(), a.clone().addScaledVector(leave, L * 0.38).addScaledVector(bow, L), b.clone().addScaledVector(arrive, -L * 0.3).addScaledVector(bow, L * 0.6), b.clone());
  const samples = curve.getPoints(24);
  return {
    at: (t: number) => curve.getPoint(Math.min(1, Math.max(0, t))),
    /** Parameter of the centreline point closest to p. */
    nearest: (p: Vector3) => { let best = 0, d = Infinity; samples.forEach((s, i) => { const e = s.distanceToSquared(p); if (e < d) { d = e; best = i; } }); return best / 24; },
    points: (t1 = 1, n = 12) => Array.from({ length: n + 1 }, (_, j) => curve.getPoint(Math.min(1, t1) * j / n)),
  };
}
export type Axis = ReturnType<typeof smoothAxis>;

/** Closest point to `p` on the segment a-b, as a fraction along it. */
function along(a: Vector3, b: Vector3, p: Vector3) {
  const ab = b.clone().sub(a);
  return Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
}

/** One instanced segment between two points; radius tapers along each sampled path. */
export function segmentMatrix(a: Vector3, b: Vector3, radius: number) {
  const delta = b.clone().sub(a);
  return new Matrix4().compose(a, new Quaternion().setFromUnitVectors(UP, delta.clone().normalize()), new Vector3(radius, delta.length(), radius));
}

/** Pure layout: stable slots, no Math.random or rounded simulation leaf counts. */
export function plantLayout(p: PlantProfile, state: PlantState, v: Visual): PlantLayout {
  const kind = architectureOf(p, v), m = p.morphology;
  const individual = p.individual;
  const landmarks = [...(individual?.leaves ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const H = state.heightCm / 100, initialH = m.currentHeightCm / 100;
  const growth = H / initialH;
  const frame = photoFrame(p, state, v);
  const grid = occupancyOf(p);
  // A dense photo never renders sparse: the photographed count, raised to what the canopy needs.
  const observed = Math.min(MAX_LEAVES, Math.max(m.leaf.countNow, densityLeafFloor(p, v)));
  const count = Math.min(MAX_LEAVES, observed * growth);
  const length = m.leaf.lengthCm / 100 * Math.min(1.6, Math.pow(growth, 0.28));
  const radius = v.stems.thicknessCm / 200 * Math.sqrt(growth);
  const soilR = potDimensions(p).radius;
  const density = individual?.crownDensity ?? 0.55;
  const crownWidth = individual?.crownShape === "column" ? 0.55 : individual?.crownShape === "fan" ? 1.15 : 1;
  const spread = Math.max(0, H * v.silhouette.widthToHeight / 2 - length * 0.42) * crownWidth * (1.2 - density * 0.35);
  const stemPaths: StemPath[] = [], organs: LeafOrgan[] = [];
  const stems: Matrix4[] = [], leaves: Matrix4[][] = [[], [], [], []];
  // Main stems: as photographed when observed (base in the pot, tip where the photo shows it), else generated.
  const seen = individual?.stems?.length ? individual.stems : null;
  const nStems = seen ? seen.length : Math.min(v.stems.count, Math.max(1, observed));
  const bases = seen
    ? seen.map(s => RIGHT.clone().multiplyScalar(Math.max(-0.85, Math.min(0.85, s.baseX * frame.W / 2 / Math.max(0.01, soilR))) * soilR).addScaledVector(TOWARD, LAYER_DEPTH[s.layer] * soilR * 0.25))
    : Array.from({ length: nStems }, (_, i) => new Vector3(Math.sin(i * GOLDEN) * soilR * 0.28 * Math.sqrt(i / nStems), 0, Math.cos(i * GOLDEN) * soilR * 0.28 * Math.sqrt(i / nStems)));
  // Stylized botanical proportions: stems a little fuller than measured, never thinner than a plant this
  // size can stand on, so they carry their flowers and fruits visibly.
  const FULL = 1.35, minStem = initialH * 0.0045 * Math.sqrt(growth);
  const stemRadius = (i: number) => Math.max(minStem, (seen ? seen[i].thicknessMm / 2000 : v.stems.thicknessCm / 200) * Math.sqrt(growth)) * FULL;
  const radiusAt = (r: number, t: number) => r * (1 - v.stems.taper * Math.pow(t, 1.6)); // matches StemGeometry
  const petioleRadius = Math.max(radius * v.botanical.structure.petioleRadius * 1.6, length * 0.018);
  const path = (id: string, points: Vector3[], r: number, depth = 0) => { stemPaths.push({ id, points, radius: r, taper: v.stems.taper, depth }); };
  // A petiole or twig: rises off its stem, arches, and arrives along the blade's own axis.
  // Longer twigs are thicker (a twig carrying a far leaf is wood, not a wire); `g` scales an emerging one.
  const petiole = (id: string, from: Vector3, to: Vector3, r: number, into?: Vector3, g = 1) => {
    const d = to.clone().sub(from), L = d.length();
    if (L < 1e-6) return;
    r = Math.max(r, L * 0.011 * g);
    d.divideScalar(L);
    const leave = d.clone().addScaledVector(UP, 0.55).normalize(), arrive = (into ?? d).clone().normalize();
    path(id, new CubicBezierCurve3(from.clone(), from.clone().addScaledVector(leave, L * 0.4), to.clone().addScaledVector(arrive, -L * 0.3), to.clone()).getPoints(8), r, 2);
  };
  const leafTop = grid ? foliageExtent(grid).top : 1.5;
  const stemTip = (stem: number) => {
    if (seen) return frame.at(seen[stem].tipX, Math.min(seen[stem].tipY, leafTop), LAYER_DEPTH[seen[stem].layer] * 0.6);
    const a = stem * GOLDEN;
    const jitter = 1 - (1 - v.silhouette.symmetry) * (0.15 + stem % 3 * 0.14);
    return new Vector3(Math.sin(a) * spread * 0.62, initialH * Math.pow(growth, 0.25) * 0.84 * jitter, Math.cos(a) * spread * 0.62);
  };
  // Each main stem leaves the soil upright, bows gently (per the photographed curvature) and turns back up
  // toward the light at its tip.
  const stemAxes: Axis[] = bases.map((base, s) => {
    const tip = stemTip(s), dir = tip.clone().sub(base).normalize();
    const r = seededRandom(`${v.seed}:stem-axis:${s}`);
    const side = new Vector3().crossVectors(dir, UP);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    const bow = side.normalize().multiplyScalar((r() - 0.5) * (0.04 + 0.08 * v.stems.curvature));
    return smoothAxis(base, tip, UP, dir.clone().add(UP).normalize(), bow);
  });
  const highestNode = new Array<number>(nStems).fill(0);
  const majorBranches: { id: string; stem: number; axis: Axis; birth: number }[] = [];
  const initialBranches = ["branching", "tree"].includes(kind) ? Math.min(24, individual?.estimatedBranchCount ?? (kind === "tree" ? m.branchingDepth * 2 : m.branchingDepth)) : 0;
  const branchesF = initialBranches + Math.max(0, count - observed) / 8;
  if (initialBranches > 0) for (let b = 0; b < Math.min(32, Math.ceil(branchesF)); b++) {
    const show = b < initialBranches ? 1 : smoothstep(0, 1, branchesF - b);
    const stem = b % nStems, level = 0.38 + Math.floor(b / nStems) * v.botanical.growth.nodeSpacing;
    const start = stemAxes[stem].at(level);
    const az = b * GOLDEN, angle = v.botanical.structure.branchAngleDeg * Math.PI / 180;
    const length = (spread * 0.65 + initialH * 0.12) * show * Math.pow(growth, 0.2);
    const end = start.clone().add(new Vector3(Math.sin(az) * Math.sin(angle) * length, Math.cos(angle) * length, Math.cos(az) * Math.sin(angle) * length));
    const id = `branch-${b}`;
    // A branch leaves its stem outward and a little up, then curves up toward the light; it starts at
    // ~70% of its parent's radius there (and tapers on), so the junction reads as grown.
    const out = new Vector3(Math.sin(az), 0, Math.cos(az));
    const axis = smoothAxis(start, end, out.clone().multiplyScalar(0.75).addScaledVector(UP, 0.55).normalize(), end.clone().sub(start).normalize().add(UP).normalize());
    path(id, axis.points(1, 12), radiusAt(stemRadius(stem), level) * 0.72 * show, 1);
    majorBranches.push({ id, stem, axis, birth: Math.max(0, b - initialBranches + 1) });
    highestNode[stem] = Math.max(highestNode[stem], level);
  }
  const vinePoint = (stem: number, t: number) => {
    const a = stem * GOLDEN, reach = H * v.silhouette.widthToHeight * 0.5;
    return bases[stem].clone().add(new Vector3(Math.sin(a) * reach * Math.sin(t * 1.4), H * (0.12 * Math.sin(t * Math.PI) - t * 0.9), Math.cos(a) * reach * Math.sin(t * 1.4)));
  };
  if (kind === "vine") bases.forEach((_, i) => path(`stem-${i}`, Array.from({ length: 13 }, (_, j) => vinePoint(i, j / 12)), stemRadius(i)));

  // Where a photographed foliage silhouette exists, leaves that are not individually observed fill it
  // (rosettes and branching plants); otherwise they follow the species' phyllotaxis as before.
  const fillsSilhouette = !!grid && (kind === "aroid" || kind === "branching" || kind === "tree");
  // Nearest wood to hang a silhouette leaf on: a main stem or an already-born major branch.
  const nearestWood = (target: Vector3) => {
    let best = { parentId: `stem-0`, stem: 0, point: bases[0].clone(), distance: Infinity, t: 0 };
    for (let s = 0; s < nStems; s++) {
      const t = Math.max(0.08, stemAxes[s].nearest(target)), point = stemAxes[s].at(t);
      const distance = point.distanceTo(target);
      if (distance < best.distance) best = { parentId: `stem-${s}`, stem: s, point, distance, t };
    }
    for (const branch of majorBranches) {
      if (branch.birth > 0) continue;
      const t = Math.max(0.2, branch.axis.nearest(target)), point = branch.axis.at(t);
      const distance = point.distanceTo(target);
      if (distance < best.distance) best = { parentId: branch.id, stem: branch.stem, point, distance, t: -1 };
    }
    return best;
  };

  for (let i = 0; i < Math.ceil(count); i++) {
    const observation = i < observed ? landmarks[i] : undefined;
    const id = observation?.id ?? (i < observed ? `inferred-${i}` : `new-${i - observed}`);
    const random = seededRandom(v.seed + ":leaf:" + id);
    const r = [random(), random(), random(), random(), random()];
    // Existing leaves are full size; future slots emerge continuously from zero at integer boundaries.
    const grow = i < observed ? 1 : smoothstep(0, 1, count - i);
    if (grow < 1e-8) continue;
    const stem = observation ? observation.stemIndex % nStems : i % nStems, rank = Math.floor(i / nStems);
    const perStem = Math.max(1, observed / nStems);
    const youth = 0.74 + 0.26 * (1 - Math.min(1, rank / perStem));
    let size = length * youth * (1 + (r[0] - 0.5) * v.leaves.sizeVariation) * grow;
    const asym = (r[1] - 0.5) * (1 - v.silhouette.symmetry);
    let az = i * GOLDEN + asym * 2;
    let point = bases[stem].clone(), attachment = bases[stem].clone(), pitch = 0.7;
    let orientation: Quaternion | null = null;
    let parentId = `stem-${stem}`;
    const droop = v.leaves.droop * 0.8 + state.wilt * 0.9;
    if (fillsSilhouette && !observation) {
      // Blade centred on a sampled point of the photographed foliage mass, facing out from the plant.
      const place = seededRandom(v.seed + ":place:" + id);
      const s = sampleFoliage(grid!, place, density);
      const centre = frame.at(s.x, s.y, s.depth);
      az = Math.hypot(centre.x, centre.z) > frame.W * 0.06 ? Math.atan2(centre.x, centre.z) + (place() - 0.5) * 0.9 : place() * Math.PI * 2;
      // The blade lies on the canopy surface, as close to the photographed leaf angle as that allows.
      const angle = Math.min(170, Math.max(10, (individual?.averageLeafAngleDeg ?? 90) + (place() - 0.5) * 36)) * Math.PI / 180 + droop;
      const face = canopyNormal(grid!, s, frame.W, frame.H, frame.depthToWidth);
      const wanted = bladeDirection(az, angle);
      const axis = wanted.clone().addScaledVector(face, -wanted.dot(face));
      if (axis.lengthSq() < 1e-6) axis.copy(bladeDirection(az, Math.PI / 2));
      axis.normalize();
      orientation = bladeFrame(axis, face, (r[4] - 0.5) * 0.3);
      point = centre.addScaledVector(axis, -size * 0.5 * grow);
      if (kind === "aroid") attachment = bases[stem].clone();
      else {
        const wood = nearestWood(point);
        attachment = wood.point; parentId = wood.parentId;
        if (wood.t >= 0) highestNode[wood.stem] = Math.max(highestNode[wood.stem], wood.t);
      }
      const lift = kind === "aroid" ? Math.max(0.02, point.y - attachment.y) * 0.35 : attachment.distanceTo(point) * 0.2;
      if (kind === "aroid") path(`petiole-${id}`, [attachment, attachment.clone().lerp(point, 0.5).add(new Vector3(0, lift, 0)), point], radius * (0.7 + 0.3 * youth) * grow, 2);
      else petiole(`petiole-${id}`, attachment, point, petioleRadius * grow, axis, grow);
    } else if (kind === "aroid") {
      const level = individual?.crownShape === "round" ? 0.52 + 0.25 * r[2] : 0.40 + 0.44 * r[2];
      const reach = spread * (0.35 + r[3] * 0.65);
      point.add(new Vector3(Math.sin(az) * reach, H * level * grow, Math.cos(az) * reach));
      const points = Array.from({ length: 6 }, (_, j) => {
        const t = j / 5;
        return bases[stem].clone().lerp(point, t).add(new Vector3(0, Math.sin(t * Math.PI) * H * 0.08, 0));
      });
      if (!observation) path(`petiole-${id}`, points, radius * (0.7 + 0.3 * youth) * grow, 2);
      pitch = 1.75 + r[4] * 0.4 + droop;
    } else if (kind === "grass" || kind === "succulent") {
      const ring = i / Math.max(1, observed);
      pitch = kind === "grass" ? 0.15 + (1 - ring) * 0.6 + droop * 0.5 : 0.55 + (1 - ring) * 0.85 + droop * 0.2;
      size *= kind === "grass" ? 0.85 + r[2] * 0.25 : 1;
      point.add(new Vector3(Math.sin(az) * soilR * 0.12, kind === "succulent" ? ring * H * 0.2 : 0, Math.cos(az) * soilR * 0.12));
    } else if (kind === "vine") {
      const t = Math.min(1, (rank + 0.5) / Math.max(perStem, count / nStems));
      point = vinePoint(stem, t);
      az = stem * GOLDEN + (rank % 2 ? 1 : -1) * 0.9;
      pitch = 1.25 + droop * 0.5;
    } else {
      const pair = v.leaves.arrangement === "opposite" ? 2 : v.leaves.arrangement === "whorled" ? 3 : 1;
      // Allocate paired leaves to a shared stem/node before moving to the next stem.
      const assignedStem = observation ? stem : Math.floor(i / pair) % nStems;
      const node = Math.floor(i / (pair * nStems));
      const totalNodes = Math.max(1, Math.ceil(observed / pair / nStems));
      const coverage = Math.min(0.8, Math.max(0.3, v.stems.internodeCm / m.currentHeightCm * Math.max(1, totalNodes - 1))) * (1 - v.condition.legginess * 0.55);
      const stage = node - (i >= observed ? 1 - grow : 0);
      const t = Math.max(0.05, 1 - coverage + stage * coverage / Math.max(1, totalNodes - 1));
      let axis = stemAxes[assignedStem].at(t);
      const available = majorBranches.filter(branch => branch.stem === assignedStem && branch.birth === 0);
      const branch = i >= observed ? majorBranches.find(branch => branch.id === `branch-${initialBranches + Math.floor((i - observed) / 8)}`) : available.length ? available[Math.floor(rank / pair) % available.length] : undefined;
      if (branch) {
        axis = branch.axis.at(0.3 + 0.65 * ((rank % 3) / 2));
        parentId = branch.id;
      }
      if (!branch) highestNode[assignedStem] = Math.max(highestNode[assignedStem], t);
      az = node * (pair === 2 ? Math.PI / 2 : GOLDEN) + (i % pair) * Math.PI * 2 / pair + assignedStem * GOLDEN + asym;
      if (v.leaves.arrangement === "rosette") az = i * GOLDEN;
      const branchL = (branch ? length * 0.15 : (kind === "tree" ? 0.18 : 0.08) * H * (1 - Math.min(1, t) * 0.5) + spread * 0.25) * grow;
      point = axis.clone().add(new Vector3(Math.sin(az) * branchL, branchL * 0.3, Math.cos(az) * branchL));
      attachment = axis;
      if (!branch) parentId = `stem-${assignedStem}`;
      if (!observation) petiole(`petiole-${id}`, axis, point, petioleRadius * grow, undefined, grow);
      pitch = 1.35 + t * 0.3 + droop;
      size *= 1 - Math.min(0.2, node / Math.max(1, totalNodes) * 0.2);
    }
    if (!observation && !fillsSilhouette && individual?.crownShape === "fan") point.z *= 0.55;
    if (individual?.averageLeafAngleDeg !== undefined && !observation && !fillsSilhouette) pitch = individual.averageLeafAngleDeg * Math.PI / 180 + droop + (r[4] - 0.5) * 0.15;
    if (observation) {
      point = frame.at(observation.x, observation.y, LAYER_DEPTH[observation.layer]);
      size = length * observation.size;
      az = CAMERA_AZ + observation.azimuthDeg * Math.PI / 180;
      pitch = observation.angleDeg * Math.PI / 180 + state.wilt * 0.65;
      // A photographed blade was seen from the camera: it shows that side (its upper face) to the camera.
      orientation = bladeFrame(bladeDirection(az, pitch), TOWARD.clone().add(UP).normalize(), (r[4] - 0.5) * 0.22);
      if (seen && kind !== "aroid") {
        // An observed blade hangs on its observed stem, at the height the photo shows it.
        const t = Math.max(0.08, stemAxes[stem].nearest(point));
        attachment = stemAxes[stem].at(t);
        highestNode[stem] = Math.max(highestNode[stem], t);
      }
      if (kind === "aroid") path(`petiole-${id}`, [attachment, attachment.clone().lerp(point, 0.5).add(new Vector3(0, initialH * 0.05, 0)), point], radius * 0.8, 2);
      else petiole(`petiole-${id}`, attachment, point, petioleRadius, bladeDirection(az, pitch));
    }
    size *= 1 - v.botanical.growth.senescence * smoothstep(1, 4, growth) * (i < observed ? 1 - i / Math.max(1, observed) : 0);
    const rotation = orientation ?? new Quaternion().setFromEuler(new Euler(0, az, 0)).multiply(new Quaternion().setFromEuler(new Euler(-Math.PI / 2 + pitch, 0, (r[4] - 0.5) * 0.22)));
    const age = i >= observed ? 0 : Math.min(3, Math.floor((1 - i / Math.max(1, observed)) * 4));
    const matrix = new Matrix4().compose(point, rotation, new Vector3(size, size, size));
    const maturity = Math.min(1, (i < observed ? (individual?.maturity ?? 0.65) + (1 - i / Math.max(1, observed)) * 0.25 : 0.1) + Math.max(0, count - Math.max(observed, i + 1)) * 0.12);
    leaves[age].push(matrix);
    organs.push({ id, parentId, birth: i < observed ? 0 : i - observed + 1, maturity, matrix, variant: age });
  }
  // Observed stems are drawn to their photographed tip; generated ones up to the highest leaf they carry.
  if (["branching", "tree"].includes(kind)) bases.forEach((base, i) => {
    path(`stem-${i}`, stemAxes[i].points(seen ? 1 : highestNode[i], 16), stemRadius(i) * (kind === "tree" ? 1.4 : 1));
  });
  // Metadata and centerline matrices remain useful for determinism/continuity tests.
  for (const stem of stemPaths) {
    const curve = new CatmullRomCurve3(stem.points);
    stems.push(segmentMatrix(curve.getPoint(0), curve.getPoint(1), stem.radius));
  }
  return { stems, stemPaths, leaves, organs };
}
