import { useMemo } from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import { taperedTube } from "./tube";

// Curved, tapering roots fanning down and out, each with a couple of side roots.
// TODO(3d-owner): shape per roots.type (taproot = one thick central root, fibrous = many thin, rhizome = horizontal...).
export default function Roots({ state }: { state: PlantState; profile: PlantProfile }) {
  const depth = Math.max(0.02, state.rootDepthCm / 100);
  const spread = Math.max(0.02, state.rootSpreadCm / 100);

  const geoms = useMemo(() => {
    let seed = 3;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.5;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const reach = (spread / 2) * (0.5 + rand() * 0.5);
      const d = depth * (0.6 + rand() * 0.4);
      const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const wob = (rand() - 0.5) * 0.25 * reach;
        return dir
          .clone()
          .multiplyScalar(reach * Math.sqrt(t) + wob)
          .add(new Vector3(0, -d * t ** 1.2 - 0.005, (rand() - 0.5) * 0.02));
      });
      const main = new CatmullRomCurve3(pts);
      out.push(taperedTube(main, 0.006, 0.0008, 20, 6));
      // side roots branching off the main root
      for (const t of [0.35, 0.6]) {
        const p0 = main.getPointAt(t);
        const side = dir.clone().applyAxisAngle(new Vector3(0, 1, 0), (rand() - 0.5) * 2.2);
        const len = reach * 0.45;
        const p2 = p0.clone().addScaledVector(side, len).add(new Vector3(0, -len * 0.6, 0));
        const p1 = p0.clone().lerp(p2, 0.5).add(new Vector3(0, len * 0.1, 0));
        out.push(taperedTube(new CatmullRomCurve3([p0, p1, p2]), 0.0025, 0.0005, 10, 5));
      }
    }
    return out;
  }, [depth, spread]);

  return (
    <group>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#d8c3a0" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
