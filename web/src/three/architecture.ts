import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "./visual";
import { seededRandom, smoothstep } from "./procedural";
import { potDimensions, type Visual } from "./visual";

export type Archetype = "aroid" | "branching" | "cactus" | "vine" | "grass" | "succulent" | "tree";
export function architectureOf(p: PlantProfile, v: Visual): Archetype {
  const m = p.morphology;
  if (m.growthForm === "succulent") return v.cactus.form === "rosette" || m.leaf.countNow > 0 ? "succulent" : "cactus";
  if (m.leaf.shape === "needle" && m.leaf.countNow === 0) return "cactus";
  if (m.growthForm === "grass" || m.growthForm === "vine" || m.growthForm === "tree") return m.growthForm;
  return m.growthForm === "rosette" || m.leaf.shape === "fenestrated" ? "aroid" : "branching";
}
export type PlantLayout = { stems: Matrix4[]; leaves: Matrix4[][] };
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
  const H = state.heightCm / 100, initialH = m.currentHeightCm / 100;
  const growth = H / initialH;
  // Claude reports the leaves it can individually resolve in a photo, which badly undercounts a
  // bushy plant: a rose came back as 4 stems and 4 leaves and rendered as 4 bare sticks. Keep the
  // photo's number whenever it is already dense, otherwise fill each stem out to a plausible
  // minimum so a leafy plant never reads as bare wood.
  const perStemFloor = kind === "aroid" ? 3 : kind === "grass" ? 6 : 8;
  const floor = m.leaf.countNow > 0 ? v.stems.count * perStemFloor : 0;
  const observed = Math.min(160, Math.max(m.leaf.countNow, floor));
  const count = Math.min(160, observed * growth);
  const length = m.leaf.lengthCm / 100 * Math.min(1.6, Math.pow(growth, 0.28));
  const radius = v.stems.thicknessCm / 200 * Math.sqrt(growth);
  const soilR = potDimensions(p).radius;
  const spread = Math.max(0, H * v.silhouette.widthToHeight / 2 - length * 0.42);
  const stems: Matrix4[] = [], leaves: Matrix4[][] = [[], [], [], []];
  // New side branches keep appearing as the plant grows. Observed leaves stay indexed against the
  // stem count they were photographed with, so nothing reshuffles when a branch is born, and the
  // base positions divide by maxStems so the existing bases never slide outward either.
  const nStems0 = Math.min(v.stems.count, Math.max(1, observed));
  const maxStems = Math.min(12, Math.round(nStems0 * 2.4));
  const nStems = Math.min(maxStems, Math.max(nStems0, Math.round(nStems0 * Math.pow(growth, 0.8))), Math.max(1, Math.ceil(count)));
  const stemOf = (i: number) => (i < observed ? nStems0 : nStems);
  const bases = Array.from({ length: nStems }, (_, i) => new Vector3(Math.sin(i * GOLDEN) * soilR * 0.28 * Math.sqrt(i / maxStems), 0, Math.cos(i * GOLDEN) * soilR * 0.28 * Math.sqrt(i / maxStems)));
  const path = (points: Vector3[], r: number) => {
    for (let i = 0; i < points.length - 1; i++) stems.push(segmentMatrix(points[i], points[i + 1], r * (1 - i / points.length * 0.55)));
  };
  const stemTip = (stem: number) => {
    const a = stem * GOLDEN;
    const jitter = 1 - (1 - v.silhouette.symmetry) * (0.15 + stem % 3 * 0.14);
    return new Vector3(Math.sin(a) * spread * 0.62, H * 0.84 * jitter, Math.cos(a) * spread * 0.62);
  };
  const highestNode = new Array<number>(nStems).fill(0);
  const vinePoint = (stem: number, t: number) => {
    const a = stem * GOLDEN, reach = H * v.silhouette.widthToHeight * 0.5;
    return bases[stem].clone().add(new Vector3(Math.sin(a) * reach * Math.sin(t * 1.4), H * (0.12 * Math.sin(t * Math.PI) - t * 0.9), Math.cos(a) * reach * Math.sin(t * 1.4)));
  };
  if (kind === "vine") bases.forEach((_, i) => path(Array.from({ length: 13 }, (_, j) => vinePoint(i, j / 12)), radius));

  for (let i = 0; i < Math.ceil(count); i++) {
    const random = seededRandom(v.seed + ":leaf:" + i);
    const r = [random(), random(), random(), random(), random(), random()];
    // Existing leaves are full size; future slots emerge continuously from zero at integer boundaries.
    // Future leaves unfurl out of order, each on its own schedule, instead of one clean queue.
    const grow = i < observed ? 1 : smoothstep(0, 1, count - i - r[5] * 0.9);
    if (grow < 1e-8) continue;
    const stem = i % stemOf(i), rank = Math.floor(i / stemOf(i));
    const perStem = Math.max(1, observed / nStems0);
    const youth = 0.74 + 0.26 * (1 - Math.min(1, rank / perStem));
    // New growth is not a clone of the old: each future leaf settles at its own mature size.
    let size = length * youth * (1 + (r[0] - 0.5) * v.leaves.sizeVariation) * (i < observed ? 1 : 0.72 + r[5] * 0.62) * grow;
    const asym = (r[1] - 0.5) * (1 - v.silhouette.symmetry);
    let az = i * GOLDEN + asym * 2;
    let point = bases[stem].clone(), pitch = 0.7;
    const droop = v.leaves.droop * 0.8 + state.wilt * 0.9;
    if (kind === "aroid") {
      // Oldest leaves sit low and reach furthest out; new ones unfurl high and close to the crown.
      const older = 1 - Math.min(1, rank / Math.max(1, perStem - 1));
      const level = 0.30 + 0.52 * (1 - older) + 0.14 * r[2];
      const reach = spread * (0.45 + older * 0.55 + r[3] * 0.25);
      point.add(new Vector3(Math.sin(az) * reach, H * level * grow, Math.cos(az) * reach));
      const points = Array.from({ length: 8 }, (_, j) => {
        const t = j / 7;
        // Petioles leave the base steeply and arch over: rise first, then bend out to the blade.
        return bases[stem].clone().lerp(point, Math.pow(t, 1.35)).add(new Vector3(0, Math.sin(t * Math.PI) * H * (0.1 + 0.2 * older), 0));
      });
      path(points, radius * (0.7 + 0.3 * youth) * grow);
      // Blades held just above horizontal, facing up and outward, not hanging.
      pitch = 1.24 + r[4] * 0.26 + droop * 0.9;
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
      const assignedStem = Math.floor(i / pair) % stemOf(i);
      const node = Math.floor(i / (pair * stemOf(i)));
      const totalNodes = Math.max(1, Math.ceil(observed / pair / nStems0));
      const coverage = Math.min(0.8, Math.max(0.3, v.stems.internodeCm / m.currentHeightCm * Math.max(1, totalNodes - 1))) * (1 - v.condition.legginess * 0.55);
      const stage = node - (i >= observed ? 1 - grow : 0);
      const t = Math.min(1.08, 1 - coverage + stage * coverage / Math.max(1, totalNodes - 1));
      highestNode[assignedStem] = Math.max(highestNode[assignedStem], t);
      const axis = bases[assignedStem].clone().lerp(stemTip(assignedStem), t);
      az = node * (pair === 2 ? Math.PI / 2 : GOLDEN) + (i % pair) * Math.PI * 2 / pair + assignedStem * GOLDEN + asym;
      if (v.leaves.arrangement === "rosette") az = i * GOLDEN;
      const branchL = ((kind === "tree" ? 0.3 : 0.12) * H * (1 - t * 0.5) + spread * 0.32) * grow;
      point = axis.clone().add(new Vector3(Math.sin(az) * branchL, branchL * 0.3, Math.cos(az) * branchL));
      path([axis, axis.clone().lerp(point, 0.5), point], radius * (kind === "tree" ? 0.55 : 0.34) * grow);
      pitch = 1.35 + t * 0.3 + droop;
      size *= 1 - Math.min(0.2, node / Math.max(1, totalNodes) * 0.2);
    }
    const rotation = new Quaternion().setFromEuler(new Euler(0, az, 0)).multiply(new Quaternion().setFromEuler(new Euler(-Math.PI / 2 + pitch, 0, (r[4] - 0.5) * 0.22)));
    const age = i >= observed ? 0 : Math.min(3, Math.floor((1 - i / Math.max(1, observed)) * 4));
    leaves[age].push(new Matrix4().compose(point, rotation, new Vector3(size, size, size)));
  }
  if (["branching", "tree"].includes(kind)) bases.forEach((base, i) => {
    if (highestNode[i] <= 0) return; // a branch slot no leaf has reached yet has no stem to draw
    const tip = base.clone().lerp(stemTip(i), highestNode[i]);
    path(Array.from({ length: 6 }, (_, j) => base.clone().lerp(tip, j / 5)), radius * (kind === "tree" ? 1.4 : 1));
  });
  return { stems, leaves };
}
