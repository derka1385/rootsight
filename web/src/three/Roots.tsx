import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { CylinderGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "./visual";
import { seededRandom } from "./procedural";
import { segmentMatrix } from "./architecture";

const SEG = new CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
const TUBER = new SphereGeometry(1, 12, 8);

/** Root architecture per roots.type: how many primaries, how thick, how strongly they follow gravity. */
const LAYOUT = {
  taproot: { primaries: 5, main: true, thick: 1.6, gravity: 0.9, laterals: 5, color: "#d8c29a" },
  fibrous: { primaries: 16, main: false, thick: 0.55, gravity: 0.45, laterals: 4, color: "#e1d3b4" },
  rhizome: { primaries: 5, main: false, thick: 1.3, gravity: 0.12, laterals: 5, color: "#cdb38a" },
  tuberous: { primaries: 8, main: false, thick: 0.9, gravity: 0.55, laterals: 3, color: "#d6c09a" },
  aerial: { primaries: 8, main: false, thick: 1.3, gravity: 0.5, laterals: 3, color: "#e2d2ad" },
} as const;

type Bounds = { radius: number; depth: number };

/**
 * Organic root system: deterministic random walks with gravitropism and wander, branching into
 * laterals and fine rootlets. Roots stay inside the pot: at the wall they turn and circle it, at
 * the bottom they spread, which is exactly what a root-bound plant looks like.
 */
export function rootLayout(profile: PlantProfile, state: PlantState, bounds: Bounds) {
  const L = LAYOUT[profile.roots.type];
  const depth = Math.min(bounds.depth * 0.96, Math.max(0.02, state.rootDepthCm / 100));
  const spread = Math.min(bounds.radius * 0.95, Math.max(0.02, state.rootSpreadCm / 200));
  const scale = Math.max(depth, spread);
  const r0 = Math.max(0.0012, 0.0022 * L.thick * Math.sqrt(scale / 0.2));
  const segments: Matrix4[] = [], fine: Matrix4[] = [], tubers: Matrix4[] = [];
  const down = new Vector3(0, -1, 0);

  const grow = (start: Vector3, dir: Vector3, length: number, radius: number, order: number, seed: string) => {
    const rand = seededRandom(seed);
    const step = Math.max(0.006, scale * 0.045);
    const n = Math.max(3, Math.round(length / step));
    const p = start.clone(), d = dir.clone().normalize();
    const branchAt = new Set(Array.from({ length: order < 2 ? L.laterals : 0 }, () => 1 + Math.floor(rand() * (n - 2))));
    for (let i = 0; i < n; i++) {
      // Gravitropism pulls down, wander keeps it organic, fine roots wander more.
      d.addScaledVector(down, L.gravity * 0.18 / (1 + order))
        .add(new Vector3(rand() - 0.5, (rand() - 0.5) * 0.5, rand() - 0.5).multiplyScalar(0.35 + order * 0.2))
        .normalize();
      const next = p.clone().addScaledVector(d, step);
      // Pot wall: slide along it (circling); pot bottom: spread sideways; soil surface: dive back in.
      const flat = Math.hypot(next.x, next.z);
      if (flat > spread) { const k = spread / flat; next.x *= k; next.z *= k; d.set(-next.z, d.y, next.x).normalize(); }
      if (next.y < -depth) { next.y = -depth; d.y = Math.abs(d.y) * 0.2; d.normalize(); }
      if (next.y > -0.004) { next.y = -0.004; d.y = -Math.abs(d.y) - 0.3; d.normalize(); }
      const radiusHere = radius * (1 - 0.7 * i / n);
      (order < 2 ? segments : fine).push(segmentMatrix(p, next.clone().lerp(p, -0.05), radiusHere));
      if (branchAt.has(i)) {
        const side = new Vector3(rand() - 0.5, -0.2 - rand() * 0.3, rand() - 0.5).normalize();
        grow(next, side, length * (order ? 0.35 : 0.5) * (1 - i / n * 0.5), radiusHere * 0.45, order + 1, `${seed}:${i}`);
      }
      if (profile.roots.type === "tuberous" && order === 0 && i === Math.floor(n * 0.55)) {
        const t = r0 * 4.5;
        tubers.push(new Matrix4().compose(next, new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), d), new Vector3(t, t, t * 1.6)));
      }
      p.copy(next);
    }
  };

  const rand = seededRandom(`${profile.species.scientificName}:roots`);
  for (let i = 0; i < L.primaries; i++) {
    const main = L.main && i === 0;
    const az = (i / L.primaries) * Math.PI * 2 + (rand() - 0.5) * 0.8;
    const out = profile.roots.type === "rhizome" ? 0.95 : main ? 0.05 : 0.35 + rand() * 0.5;
    const dir = new Vector3(Math.sin(az) * out, -1 + out * 0.6, Math.cos(az) * out);
    const length = (main ? depth * 1.1 : Math.hypot(depth, spread) * (0.8 + rand() * 0.5));
    const start = new Vector3(Math.sin(az) * spread * 0.05, -0.006, Math.cos(az) * spread * 0.05);
    grow(start, dir, length, main ? r0 * 1.8 : r0 * (0.7 + rand() * 0.5), 0, `${profile.species.scientificName}:root:${i}`);
  }
  return { segments, fine, tubers };
}

export default function Roots({ state, profile, bounds }: { state: PlantState; profile: PlantProfile; bounds: Bounds }) {
  const color = LAYOUT[profile.roots.type].color;
  const mats = useMemo(() => ({
    // A touch of emissive so roots read against the dark soil section.
    main: new MeshStandardMaterial({ color, roughness: 0.8, emissive: color, emissiveIntensity: 0.12 }),
    fine: new MeshStandardMaterial({ color: "#efe4ca", roughness: 0.9, emissive: "#efe4ca", emissiveIntensity: 0.1 }),
  }), [color]);
  useEffect(() => () => { mats.main.dispose(); mats.fine.dispose(); }, [mats]);
  const layout = useMemo(() => rootLayout(profile, state, bounds), [profile, state.rootDepthCm, state.rootSpreadCm, bounds.radius, bounds.depth]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>
    <Instanced geometry={SEG} material={mats.main} matrices={layout.segments} />
    <Instanced geometry={SEG} material={mats.fine} matrices={layout.fine} />
    <Instanced geometry={TUBER} material={mats.main} matrices={layout.tubers} />
  </>;
}

function Instanced({ geometry, material, matrices }: { geometry: CylinderGeometry | SphereGeometry; material: MeshStandardMaterial; matrices: Matrix4[] }) {
  const ref = useRef<InstancedMesh>(null);
  const capacity = Math.max(1, matrices.length);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh key={capacity} ref={ref} args={[geometry, material, capacity]} dispose={null} />;
}
