import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { MeshStandardMaterial, SphereGeometry } from "three";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "./visual";
import { seededRandom } from "./procedural";
import { Chain, type Seg } from "./parts";

type Gene = { az: number; tilt: number; len: number; wob: number[]; lat: number[] };

const TUBER = new SphereGeometry(1, 10, 8);

/** Root systems per roots.type, grown from the same bendable chains as the stems, pointing down. */
const LAYOUT = {
  taproot: { primaries: 1, laterals: 5, thick: 2.4, spreadBias: 0.15 },
  fibrous: { primaries: 11, laterals: 2, thick: 0.6, spreadBias: 1 },
  rhizome: { primaries: 4, laterals: 3, thick: 1.4, spreadBias: 1.6 },
  tuberous: { primaries: 6, laterals: 2, thick: 1, spreadBias: 0.8 },
  aerial: { primaries: 5, laterals: 1, thick: 0.9, spreadBias: 0.9 },
} as const;

export default function Roots({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  const type = profile.roots.type;
  const L = LAYOUT[type];
  const genes = useMemo<Gene[]>(() => {
    const r = seededRandom(profile.species.scientificName + ":roots");
    return Array.from({ length: L.primaries }, () => ({
      az: r(), tilt: r(), len: r(),
      wob: Array.from({ length: 6 }, () => r() - 0.5),
      lat: Array.from({ length: 6 }, () => r()),
    }));
  }, [profile.species.scientificName, L.primaries]);
  const mat = useMemo(() => new MeshStandardMaterial({ color: "#d6c29c", roughness: 0.92 }), []);
  const fine = useMemo(() => new MeshStandardMaterial({ color: "#bba27a", roughness: 0.95 }), []);
  useEffect(() => () => { mat.dispose(); fine.dispose(); }, [mat, fine]);

  const depth = Math.max(0.02, state.rootDepthCm / 100);
  const spread = Math.max(0.02, state.rootSpreadCm / 100);
  const r0 = Math.max(0.0015, 0.004 * L.thick * Math.sqrt(depth / 0.3));

  return (
    // Chains grow along +y; flip the whole system so roots head down into the soil.
    <group rotation-x={Math.PI}>
      {genes.map((g, i) => {
        const central = type === "taproot";
        // Angle away from vertical: taproot straight down, rhizomes almost horizontal.
        const tilt = central ? 0.05 : Math.min(1.45, Math.atan2(spread * 0.5 * L.spreadBias * (0.6 + 0.6 * g.tilt), depth));
        const len = (central ? depth : Math.hypot(depth * Math.cos(tilt), spread * 0.5)) * (0.75 + 0.35 * g.len);
        const n = 5;
        const segs: Seg[] = Array.from({ length: n }, (_, k) => ({
          len: len / n,
          r: r0 * Math.pow(0.74, k),
          bx: (k === 0 ? tilt : -tilt * 0.12) + g.wob[k] * 0.35, // bends back towards gravity, irregularly
          bz: g.wob[k + 1] * 0.25,
        }));
        const at: Record<number, ReactNode> = {};
        for (let k = 0; k < L.laterals; k++) {
          const node = 1 + (k % (n - 2));
          const ll = len * (central ? 0.55 : 0.35) * (0.6 + 0.6 * g.lat[k % 6]);
          at[node] = (
            <>
              {at[node]}
              <group rotation-y={g.lat[(k + 2) % 6] * Math.PI * 2}>
                <Chain
                  material={fine}
                  segs={Array.from({ length: 3 }, (_, q) => ({ len: ll / 3, r: r0 * 0.38 * Math.pow(0.7, q), bx: q === 0 ? 0.9 + g.lat[k % 6] * 0.4 : -0.18, bz: g.wob[q] * 0.3 }))}
                />
              </group>
            </>
          );
        }
        if (type === "tuberous" && i % 2 === 0) {
          const t = r0 * 3.2;
          at[2] = <>{at[2]}<mesh geometry={TUBER} material={mat} scale={[t, t * 1.5, t]} /></>;
        }
        return (
          <group key={i} rotation-y={central ? 0 : (i / genes.length) * Math.PI * 2 + (g.az - 0.5) * 0.7}>
            <Chain segs={segs} material={mat} at={at} />
          </group>
        );
      })}
    </group>
  );
}
