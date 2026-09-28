import { CatmullRomCurve3, Euler, Matrix4, Quaternion, Vector3 } from "three";
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
  const observed = Math.min(160, m.leaf.countNow);
  const count = Math.min(160, observed * growth);
  const length = m.leaf.lengthCm / 100 * Math.min(1.6, Math.pow(growth, 0.28));
  const radius = v.stems.thicknessCm / 200 * Math.sqrt(growth);
  const soilR = potDimensions(p).radius;
  const density = individual?.crownDensity ?? 0.55;
  const crownWidth = individual?.crownShape === "column" ? 0.55 : individual?.crownShape === "fan" ? 1.15 : 1;
  const spread = Math.max(0, H * v.silhouette.widthToHeight / 2 - length * 0.42) * crownWidth * (1.2 - density * 0.35);
  const stemPaths: StemPath[] = [], organs: LeafOrgan[] = [];
  const stems: Matrix4[] = [], leaves: Matrix4[][] = [[], [], [], []];
  const nStems = Math.min(v.stems.count, Math.max(1, observed));
  const bases = Array.from({ length: nStems }, (_, i) => new Vector3(Math.sin(i * GOLDEN) * soilR * 0.28 * Math.sqrt(i / nStems), 0, Math.cos(i * GOLDEN) * soilR * 0.28 * Math.sqrt(i / nStems)));
  const path = (id: string, points: Vector3[], r: number, depth = 0) => {
    const random = seededRandom(v.seed + id);
    const curvature = v.stems.curvature * (random() - 0.5);
    const delta = points.at(-1)!.clone().sub(points[0]);
    const curved = points.map((point, i) => point.clone().add(new Vector3(Math.sin(i / (points.length - 1) * Math.PI) * delta.length() * curvature * 0.2, 0, Math.sin(i / (points.length - 1) * Math.PI) * delta.length() * curvature * 0.1)));
    stemPaths.push({ id, points: curved, radius: r, taper: v.stems.taper, depth });
  };
  const stemTip = (stem: number) => {
    const a = stem * GOLDEN;
    const jitter = 1 - (1 - v.silhouette.symmetry) * (0.15 + stem % 3 * 0.14);
    return new Vector3(Math.sin(a) * spread * 0.62, initialH * Math.pow(growth, 0.25) * 0.84 * jitter, Math.cos(a) * spread * 0.62);
  };
  const highestNode = new Array<number>(nStems).fill(0);
  const majorBranches: { id: string; stem: number; start: Vector3; end: Vector3; birth: number }[] = [];
  const initialBranches = ["branching", "tree"].includes(kind) ? Math.min(24, individual?.estimatedBranchCount ?? (kind === "tree" ? m.branchingDepth * 2 : m.branchingDepth)) : 0;
  const branchesF = initialBranches + Math.max(0, count - observed) / 8;
  if (initialBranches > 0) for (let b = 0; b < Math.min(32, Math.ceil(branchesF)); b++) {
    const show = b < initialBranches ? 1 : smoothstep(0, 1, branchesF - b);
    const stem = b % nStems, level = 0.38 + Math.floor(b / nStems) * v.botanical.growth.nodeSpacing;
    const start = bases[stem].clone().lerp(stemTip(stem), level);
    const az = b * GOLDEN, angle = v.botanical.structure.branchAngleDeg * Math.PI / 180;
    const length = (spread * 0.65 + initialH * 0.12) * show * Math.pow(growth, 0.2);
    const end = start.clone().add(new Vector3(Math.sin(az) * Math.sin(angle) * length, Math.cos(angle) * length, Math.cos(az) * Math.sin(angle) * length));
    const id = `branch-${b}`;
    path(id, [start, start.clone().lerp(end, 0.5).add(new Vector3(0, length * 0.08, 0)), end], radius * v.botanical.structure.branchRadius * show, 1);
    majorBranches.push({ id, stem, start, end, birth: Math.max(0, b - initialBranches + 1) });
    highestNode[stem] = Math.max(highestNode[stem], level);
  }
  const vinePoint = (stem: number, t: number) => {
    const a = stem * GOLDEN, reach = H * v.silhouette.widthToHeight * 0.5;
    return bases[stem].clone().add(new Vector3(Math.sin(a) * reach * Math.sin(t * 1.4), H * (0.12 * Math.sin(t * Math.PI) - t * 0.9), Math.cos(a) * reach * Math.sin(t * 1.4)));
  };
  if (kind === "vine") bases.forEach((_, i) => path(`stem-${i}`, Array.from({ length: 13 }, (_, j) => vinePoint(i, j / 12)), radius));

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
    let parentId = `stem-${stem}`;
    const droop = v.leaves.droop * 0.8 + state.wilt * 0.9;
    if (kind === "aroid") {
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
      let axis = bases[assignedStem].clone().lerp(stemTip(assignedStem), t);
      const available = majorBranches.filter(branch => branch.stem === assignedStem && branch.birth === 0);
      const branch = i >= observed ? majorBranches.find(branch => branch.id === `branch-${initialBranches + Math.floor((i - observed) / 8)}`) : available.length ? available[Math.floor(rank / pair) % available.length] : undefined;
      if (branch) {
        axis = branch.start.clone().lerp(branch.end, 0.3 + 0.65 * ((rank % 3) / 2));
        parentId = branch.id;
      }
      if (!branch) highestNode[assignedStem] = Math.max(highestNode[assignedStem], t);
      az = node * (pair === 2 ? Math.PI / 2 : GOLDEN) + (i % pair) * Math.PI * 2 / pair + assignedStem * GOLDEN + asym;
      if (v.leaves.arrangement === "rosette") az = i * GOLDEN;
      const branchL = (branch ? length * 0.15 : (kind === "tree" ? 0.18 : 0.08) * H * (1 - Math.min(1, t) * 0.5) + spread * 0.25) * grow;
      point = axis.clone().add(new Vector3(Math.sin(az) * branchL, branchL * 0.3, Math.cos(az) * branchL));
      attachment = axis;
      if (!branch) parentId = `stem-${assignedStem}`;
      if (!observation) path(`petiole-${id}`, [axis, axis.clone().lerp(point, 0.5).add(new Vector3(0, branchL * 0.15, 0)), point], radius * v.botanical.structure.petioleRadius * grow, 2);
      pitch = 1.35 + t * 0.3 + droop;
      size *= 1 - Math.min(0.2, node / Math.max(1, totalNodes) * 0.2);
    }
    if (!observation && individual?.crownShape === "fan") point.z *= 0.55;
    if (individual?.averageLeafAngleDeg !== undefined && !observation) pitch = individual.averageLeafAngleDeg * Math.PI / 180 + droop + (r[4] - 0.5) * 0.15;
    if (observation) {
      const cameraAz = Math.atan2(1.6, 2.4), depth = ({ foreground: 1, middle: 0, background: -1 } as const)[observation.layer];
      const width = initialH * v.silhouette.widthToHeight * Math.pow(growth, 0.3);
      point = new Vector3(Math.cos(cameraAz) * observation.x * width / 2 + Math.sin(cameraAz) * depth * width * (individual?.depthToWidth ?? 0.4) / 2, observation.y * initialH * Math.pow(growth, 0.3), -Math.sin(cameraAz) * observation.x * width / 2 + Math.cos(cameraAz) * depth * width * (individual?.depthToWidth ?? 0.4) / 2);
      size = length * observation.size;
      az = cameraAz + observation.azimuthDeg * Math.PI / 180;
      pitch = observation.angleDeg * Math.PI / 180 + state.wilt * 0.65;
      path(`petiole-${id}`, [attachment, attachment.clone().lerp(point, 0.5).add(new Vector3(0, initialH * 0.05, 0)), point], radius * (kind === "aroid" ? 0.8 : v.botanical.structure.petioleRadius), 2);
    }
    size *= 1 - v.botanical.growth.senescence * smoothstep(1, 4, growth) * (i < observed ? 1 - i / Math.max(1, observed) : 0);
    const rotation = new Quaternion().setFromEuler(new Euler(0, az, 0)).multiply(new Quaternion().setFromEuler(new Euler(-Math.PI / 2 + pitch, 0, (r[4] - 0.5) * 0.22)));
    const age = i >= observed ? 0 : Math.min(3, Math.floor((1 - i / Math.max(1, observed)) * 4));
    const matrix = new Matrix4().compose(point, rotation, new Vector3(size, size, size));
    const maturity = Math.min(1, (i < observed ? (individual?.maturity ?? 0.65) + (1 - i / Math.max(1, observed)) * 0.25 : 0.1) + Math.max(0, count - Math.max(observed, i + 1)) * 0.12);
    leaves[age].push(matrix);
    organs.push({ id, parentId, birth: i < observed ? 0 : i - observed + 1, maturity, matrix, variant: age });
  }
  if (["branching", "tree"].includes(kind)) bases.forEach((base, i) => {
    const tip = base.clone().lerp(stemTip(i), highestNode[i]);
    path(`stem-${i}`, Array.from({ length: 6 }, (_, j) => base.clone().lerp(tip, j / 5)), radius * (kind === "tree" ? 1.4 : 1));
  });
  // Metadata and centerline matrices remain useful for determinism/continuity tests.
  for (const stem of stemPaths) {
    const curve = new CatmullRomCurve3(stem.points);
    stems.push(segmentMatrix(curve.getPoint(0), curve.getPoint(1), stem.radius));
  }
  return { stems, stemPaths, leaves, organs };
}
