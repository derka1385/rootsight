import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import {
  BufferGeometry, Color, ConeGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh,
  Matrix4, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import { clamp01, seededRandom, smoothstep, type LeafForm } from "./procedural";
import { Chain, Leaf, taper, type Seg } from "./parts";
import { leafTexture } from "./textures";

const GOLDEN_ANGLE = 2.39996;
const DRY = new Color("#8f7a45");

type Archetype = "rosette" | "branching" | "cactus";
type Mats = { leaves: MeshStandardMaterial[]; stem: MeshStandardMaterial; petiole: MeshStandardMaterial; spine: MeshStandardMaterial };

/** Pick the plant architecture from existing profile fields only. */
export function archetypeOf(p: PlantProfile): Archetype {
  const { growthForm, leaf } = p.morphology;
  if (growthForm === "succulent" || (leaf.shape === "needle" && leaf.countNow === 0)) return "cactus";
  if (growthForm === "rosette" || growthForm === "grass") return "rosette";
  if (["fenestrated", "palmate", "round"].includes(leaf.shape) || leaf.lengthCm >= 15) return "rosette";
  return "branching";
}

function leafFormOf(p: PlantProfile): LeafForm {
  switch (p.morphology.leaf.shape) {
    case "fenestrated": case "palmate": case "round": return "cordate";
    case "lanceolate": return "lanceolate";
    case "needle": return "needle";
    default: return "ovate";
  }
}

/**
 * Leaf materials from youngest (lighter, yellower) to oldest (deeper), browning continuously with wilt.
 * Colours are desaturated a touch so greens stay botanical, not neon.
 */
function useMaterials(p: PlantProfile, wilt: number): Mats {
  const w = Math.round(wilt * 20) / 20; // rebuild at most 20 times across the whole slider
  const mats = useMemo(() => {
    const base = new Color(p.morphology.leaf.color);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    const leaves = [0.09, 0.04, 0, -0.04].map((dl, i) => {
      const c = new Color().setHSL(hsl.h + (i === 0 ? 0.02 : 0), hsl.s * 0.82 * (1 - 0.35 * w), hsl.l + dl);
      c.lerp(DRY, w * 0.55);
      // A little self-glow stands in for light passing through the blade, so undersides never go black.
      return new MeshStandardMaterial({ color: c, map: leafTexture(), emissive: c.clone().multiplyScalar(0.22), emissiveMap: leafTexture(), roughness: 0.62 + i * 0.04, metalness: 0, side: DoubleSide });
    });
    const stemC = new Color(p.morphology.stemColor).lerp(DRY, w * 0.35);
    return {
      leaves,
      stem: new MeshStandardMaterial({ color: stemC, roughness: 0.85 }),
      petiole: new MeshStandardMaterial({ color: stemC.clone().lerp(new Color(p.morphology.leaf.color), 0.35), roughness: 0.8 }),
      spine: new MeshStandardMaterial({ color: new Color(p.morphology.leaf.color).lerp(DRY, w * 0.3), roughness: 0.6 }),
    };
  }, [p.morphology.leaf.color, p.morphology.stemColor, w]);
  useEffect(() => () => {
    mats.leaves.forEach((m) => m.dispose());
    mats.stem.dispose(); mats.petiole.dispose(); mats.spine.dispose();
  }, [mats]);
  return mats;
}

/** Continuous leaf count (simulate() rounds it), so leaves grow in instead of popping. */
const leafCountF = (p: PlantProfile, s: PlantState) => (p.morphology.leaf.countNow * s.heightCm) / p.morphology.currentHeightCm;

export default function Plant({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  const mats = useMaterials(profile, state.wilt);
  const kind = archetypeOf(profile);
  return (
    <group rotation-z={kind === "cactus" ? state.wilt * 0.08 : state.wilt * 0.05}>
      {kind === "rosette" && <Rosette profile={profile} state={state} mats={mats} />}
      {kind === "branching" && <Branching profile={profile} state={state} mats={mats} />}
      {kind === "cactus" && <Cactus profile={profile} state={state} mats={mats} />}
    </group>
  );
}

/* ---------------------------------------------------------------- rosette / aroid (monstera) */

const MAX_ROSETTE = 18;

function Rosette({ profile, state, mats }: { profile: PlantProfile; state: PlantState; mats: Mats }) {
  const m = profile.morphology;
  const genes = useMemo(() => {
    const r = seededRandom(profile.species.scientificName + ":rosette");
    return Array.from({ length: MAX_ROSETTE }, () => ({ az: r(), lean: r(), len: r(), roll: r(), bend: r() }));
  }, [profile.species.scientificName]);

  const form = leafFormOf(profile);
  const H = state.heightCm / 100;
  const leafL = m.leaf.lengthCm / 100;
  const growthGain = Math.min(1.5, Math.pow(state.heightCm / m.currentHeightCm, 0.3));
  const petioleFrac = form === "cordate" ? 1 : 0.12; // aroids: long petioles; grasses/rosettes: blades from the base
  const lc = Math.min(MAX_ROSETTE, leafCountF(profile, state));
  const wilt = state.wilt;

  const leaves: ReactNode[] = [];
  for (let i = 0; i < Math.min(MAX_ROSETTE, Math.ceil(lc) + 1); i++) {
    const g = genes[i];
    const age = lc - i;
    const grow = smoothstep(0, 1.2, age);
    if (grow <= 0.001) continue;
    const mature = clamp01(age / 5); // older leaves: bigger, lean further out, split
    const size = leafL * (0.42 + 0.5 * mature) * growthGain * grow * (0.88 + 0.24 * g.len);
    const lp = Math.max(0.01, petioleFrac * H * (0.42 + 0.33 * mature) * (0.85 + 0.3 * g.len) * grow);
    const lean = (0.18 + 0.8 * mature) * (0.75 + 0.5 * g.lean);
    const rest = lean * 0.07 + 0.12 * mature + wilt * 0.16 + (g.bend - 0.5) * 0.08;
    const segs = taper(5, lp, Math.max(0.0025, leafL * 0.028) * (0.55 + 0.45 * mature), lean * 0.7, rest);
    const bent = segs.reduce((a, s) => a + s.bx, 0);
    const pitch = Math.min(1.5, Math.max(0.25, 1.8 - bent)) * (0.6 + 0.4 * mature) + wilt * 0.55;
    const mat = mats.leaves[Math.min(3, Math.floor(mature * 4))];
    leaves.push(
      <group key={i} rotation-y={i * GOLDEN_ANGLE + (g.az - 0.5) * 0.5} position-y={0.004 * i}>
        <Chain
          segs={segs}
          material={mats.petiole}
          tip={<Leaf form={form} split={m.leaf.shape === "fenestrated" && mature > 0.45} size={size} pitch={pitch} roll={(g.roll - 0.5) * 0.6} material={mat} />}
        />
      </group>,
    );
  }

  return (
    <group>
      {/* short basal stem the petioles emerge from */}
      {form === "cordate" && <Chain segs={taper(2, Math.max(0.02, H * 0.07), Math.max(0.006, leafL * 0.05), 0.08, 0.05)} material={mats.stem} />}
      {leaves}
    </group>
  );
}

/* ---------------------------------------------------------------- upright branching (basil) */

function Branching({ profile, state, mats }: { profile: PlantProfile; state: PlantState; mats: Mats }) {
  const m = profile.morphology;
  const N = 6 + m.branchingDepth;
  const genes = useMemo(() => {
    const r = seededRandom(profile.species.scientificName + ":branching");
    return Array.from({ length: 16 }, () => ({ wx: r(), wz: r(), a: r(), b: r(), c: r(), d: r() }));
  }, [profile.species.scientificName]);

  const form = leafFormOf(profile);
  const K = Math.max(m.matureHeightCm, m.currentHeightCm) / 100;
  const internode = (K / N) * 1.05;
  const nodeF = Math.pow(clamp01(state.heightCm / 100 / K), 0.6) * N; // nodes formed so far, continuous
  const leafL = m.leaf.lengthCm / 100;
  const r0 = Math.max(0.0025, 0.006 * Math.sqrt(K / 0.5));
  const branchAngle = (m.branchingAngleDeg * Math.PI) / 180;
  const wilt = state.wilt;

  const leafPair = (key: string, sizeBase: number, age: number, radius: number, gene: { c: number; d: number }) => {
    const s = smoothstep(0, 1, age);
    if (s <= 0.001) return null;
    const youth = 0.55 + 0.45 * clamp01(age / 3);
    const mat = mats.leaves[age < 1.5 ? 0 : age < 3 ? 1 : 2 + Math.round(gene.c)];
    return [0, Math.PI].map((side, k) => (
      <group key={key + k} rotation-y={side + (gene.d - 0.5) * 0.4}>
        <Chain
          segs={taper(2, leafL * 0.22 * s, radius * 0.35, 0.95 - 0.2 * gene.c, 0.18 + wilt * 0.4)}
          material={mats.petiole}
          tip={<Leaf form={form} size={sizeBase * s * youth * (0.85 + 0.3 * (k ? gene.c : gene.d))} pitch={0.45 + wilt * 1.15} roll={(gene.c - 0.5) * 0.5} material={mat} />}
        />
      </group>
    ));
  };

  const branch = (j: number, gene: (typeof genes)[number]) => {
    const bf = nodeF - j - 1.2;
    if (bf <= 0) return null;
    const nb = Math.min(4, 2 + m.branchingDepth);
    const segs: Seg[] = [];
    const at: Record<number, ReactNode> = {};
    for (let k = 0; k < nb; k++) {
      const s = smoothstep(0, 1, bf - k * 0.8);
      if (s <= 0) break;
      segs.push({
        len: internode * 0.55 * s * (1 - 0.15 * k),
        r: r0 * 0.6 * Math.pow(0.82, k),
        bx: k === 0 ? branchAngle : -branchAngle * 0.22 + wilt * 0.1,
        ry: Math.PI / 2,
      });
      at[k] = leafPair(`b${j}-${k}`, leafL * 0.8, bf - k * 0.8, r0 * 0.6, genes[(j + k) % genes.length]);
    }
    return (
      <group rotation-y={Math.PI / 2 + (gene.a - 0.5) * 0.6}>
        <Chain segs={segs} material={mats.stem} at={at} />
      </group>
    );
  };

  const segs: Seg[] = [];
  const at: Record<number, ReactNode> = {};
  for (let j = 0; j < Math.min(N, Math.ceil(nodeF) + 1); j++) {
    const s = smoothstep(0, 1, nodeF - j);
    if (s <= 0) break;
    const g = genes[j % genes.length];
    segs.push({
      len: internode * (1 - (0.35 * j) / N) * s,
      r: r0 * Math.pow(0.9, j),
      bx: (g.wx - 0.5) * 0.12 + (wilt * 0.08 * j) / N,
      bz: (g.wz - 0.5) * 0.12,
      ry: Math.PI / 2, // decussate: each leaf pair turns 90 degrees from the one below
    });
    at[j] = (
      <>
        {leafPair(`n${j}`, leafL, nodeF - j - 0.3, r0, g)}
        {j >= 1 && j <= Math.min(N - 3, m.branchingDepth + 2) && branch(j, g)}
      </>
    );
  }

  // Stretch the internodes so the stem is exactly as tall as the simulation says.
  const built = segs.reduce((a, sg) => a + sg.len, 0);
  const fit = built > 0 ? state.heightCm / 100 / built : 1;
  segs.forEach((sg) => { sg.len *= fit; });

  return <Chain segs={segs} material={mats.stem} at={at} tip={leafPair("top", leafL * 0.6, nodeF - segs.length + 0.6, r0, genes[0])} />;
}

/* ---------------------------------------------------------------- columnar cactus */

type CactusKind = "barrel" | "column";

/** Radius profile along the body height t in [0, 1]. */
function cactusProfile(t: number, kind: CactusKind): number {
  if (kind === "barrel") return t < 0.4 ? 0.82 + 0.18 * Math.sin((Math.PI / 2) * (t / 0.4)) : Math.sqrt(Math.max(0, 1 - ((t - 0.4) / 0.6) ** 2));
  return t < 0.8 ? 1 + 0.05 * Math.sin((Math.PI * t) / 0.8) : Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2));
}

const bodyCache = new Map<string, BufferGeometry>();

/** Ribbed body, radius 1, height 1, closed rounded top; built once per rib count and kind. */
function cactusBody(ribs: number, kind: CactusKind): BufferGeometry {
  const key = `${kind}:${ribs}`;
  const hit = bodyCache.get(key);
  if (hit) return hit;
  const A = ribs * 4, R = 20;
  const pos: number[] = [], idx: number[] = [];
  for (let r = 0; r <= R; r++) {
    const t = r / R;
    const prof = cactusProfile(t, kind);
    for (let a = 0; a <= A; a++) {
      const th = (a / A) * Math.PI * 2;
      const rad = prof * (1 + (kind === "barrel" ? 0.09 : 0.13) * Math.cos(ribs * th));
      pos.push(Math.cos(th) * rad, t, Math.sin(th) * rad);
    }
  }
  for (let r = 0; r < R; r++) for (let a = 0; a < A; a++) {
    const i = r * (A + 1) + a, j = i + A + 1;
    idx.push(i, j, i + 1, i + 1, j, j + 1); // counter-clockwise from outside
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  bodyCache.set(key, g);
  return g;
}

const SPINE = new ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0);
const SPINE_ROWS = 9;

function Cactus({ profile, state, mats }: { profile: PlantProfile; state: PlantState; mats: Mats }) {
  const m = profile.morphology;
  const genes = useMemo(() => {
    const r = seededRandom(profile.species.scientificName + ":cactus");
    const kind: CactusKind = m.matureHeightCm <= 100 && m.branchingDepth <= 1 ? "barrel" : "column";
    const ribs = kind === "barrel" ? 18 + Math.floor(r() * 6) : 9 + Math.floor(r() * 4);
    return { kind, ribs, arms: Array.from({ length: 3 }, () => ({ az: r(), h: r(), len: r() })) };
  }, [profile.species.scientificName, m.matureHeightCm, m.branchingDepth]);

  const H = state.heightCm / 100;
  const gp = state.heightCm / Math.max(m.matureHeightCm, m.currentHeightCm);
  const R = (genes.kind === "barrel" ? 0.012 + 0.6 * H : 0.03 + 0.11 * H) * (1 - 0.15 * state.wilt); // shrivels when thirsty
  const body = cactusBody(genes.ribs, genes.kind);
  const spineLen = (m.leaf.lengthCm / 100) * 0.35;
  const spines = useRef<InstancedMesh>(null);

  // Spines along each rib crest, re-placed in metres whenever the body resizes (stays undistorted).
  useLayoutEffect(() => {
    const mesh = spines.current;
    if (!mesh) return;
    const mtx = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), dir = new Vector3(), p = new Vector3(), s = new Vector3();
    let n = 0;
    for (let k = 0; k < genes.ribs; k++) {
      const th = (k / genes.ribs) * Math.PI * 2;
      for (let row = 0; row < SPINE_ROWS; row++) {
        const t = 0.06 + (row / SPINE_ROWS) * 0.84 + (k % 2) * 0.04;
        const prof = cactusProfile(t, genes.kind);
        const rr = R * prof * (genes.kind === "barrel" ? 1.09 : 1.13);
        p.set(Math.cos(th) * rr, t * H, Math.sin(th) * rr);
        dir.set(Math.cos(th) * prof, 0.35 + (1 - prof) * 1.2, Math.sin(th) * prof).normalize(); // crown spines point up
        q.setFromUnitVectors(up, dir);
        const len = spineLen * (0.7 + 0.3 * prof);
        s.set(len * 0.12, len, len * 0.12);
        mesh.setMatrixAt(n++, mtx.compose(p, q, s));
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }, [genes.ribs, genes.kind, R, H, spineLen]);

  const nArms = genes.kind === "column" ? Math.min(3, m.branchingDepth + 1) : 0;
  return (
    <group>
      <mesh geometry={body} material={mats.stem} scale={[R, H, R]} castShadow receiveShadow />
      <instancedMesh key={genes.ribs} ref={spines} args={[SPINE, undefined, genes.ribs * SPINE_ROWS]} material={mats.spine} />
      {genes.arms.slice(0, nArms).map((a, k) => {
        const show = smoothstep(0.35 + 0.15 * k, 0.6 + 0.15 * k, gp);
        if (show <= 0) return null;
        const ar = R * 0.62;
        const up = H * (0.3 + 0.2 * a.len) * show;
        return (
          <group key={k} position-y={H * (0.35 + 0.15 * a.h)} rotation-y={a.az * Math.PI * 2}>
            {/* elbow growing out sideways, then the arm turning upward */}
            <mesh castShadow geometry={body} material={mats.stem} position-x={R * 0.5} rotation-z={-Math.PI / 2 * 0.9} scale={[ar * show, R * 1.4 * show, ar * show]} />
            <mesh castShadow geometry={body} material={mats.stem} position-x={R * 0.5 + R * 1.25 * show} position-y={-ar * 0.2} scale={[ar * show, up, ar * show]} />
          </group>
        );
      })}
    </group>
  );
}

/** Rough radius of the plant at soil level, so the pot is never narrower than a barrel cactus. */
export function baseRadius(profile: PlantProfile, state: PlantState): number {
  if (archetypeOf(profile) !== "cactus") return 0;
  const H = state.heightCm / 100, m = profile.morphology;
  return m.matureHeightCm <= 100 && m.branchingDepth <= 1 ? 0.012 + 0.6 * H : 0.03 + 0.11 * H;
}
