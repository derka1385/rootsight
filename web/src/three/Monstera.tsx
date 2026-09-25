import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, CubicBezierCurve3, DoubleSide, Group, MathUtils, PlaneGeometry, Vector3 } from "three";
import { taperedTube } from "./tube";
import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import { ATTACH, LEAF_FRAC, leafTextures } from "./leafTexture";

// Art-directed Monstera: hand-placed leaves on tapered, arching petioles from one crown,
// composed for the default camera (which looks from +Z). Big old leaves low and outward,
// young ones near the top/centre.

/** Height of the composition at scale 1, used to map state.heightCm to a group scale. */
const DESIGN_HEIGHT = 0.62;

type Spec = { az: number; reach: number; h: number; size: number; pitch: number; roll: number; v: number; young: number };
// az: degrees, 0 = toward the camera (+Z), positive = counter-clockwise seen from above (toward +X).
const SPECS: Spec[] = [
  { az: -80, reach: 0.34, h: 0.24, size: 1.0, pitch: -22, roll: -34, v: 0, young: 0 },
  { az: 74, reach: 0.34, h: 0.2, size: 0.98, pitch: -26, roll: 30, v: 1, young: 0 },
  { az: 140, reach: 0.28, h: 0.36, size: 0.92, pitch: 8, roll: 18, v: 2, young: 0.1 },
  { az: -138, reach: 0.27, h: 0.4, size: 0.9, pitch: 10, roll: -18, v: 0, young: 0.15 },
  { az: 16, reach: 0.22, h: 0.16, size: 0.82, pitch: -40, roll: 4, v: 1, young: 0.2 },
  { az: -28, reach: 0.16, h: 0.44, size: 0.72, pitch: -16, roll: -14, v: 3, young: 0.45 },
  { az: 108, reach: 0.15, h: 0.5, size: 0.6, pitch: -2, roll: 26, v: 3, young: 0.65 },
  { az: -150, reach: 0.16, h: 0.5, size: 0.5, pitch: 18, roll: -10, v: 4, young: 0.85 },
  { az: 186, reach: 0.12, h: 0.54, size: 0.42, pitch: 26, roll: 0, v: 4, young: 1 },
  { az: 44, reach: 0.2, h: 0.32, size: 0.78, pitch: -22, roll: 22, v: 2, young: 0.35 },
  { az: -50, reach: 0.24, h: 0.28, size: 0.84, pitch: -24, roll: -22, v: 1, young: 0.3 },
  { az: 165, reach: 0.18, h: 0.48, size: 0.66, pitch: 14, roll: 8, v: 3, young: 0.55 },
];
export const MAX_LEAVES = SPECS.length;

const deg = MathUtils.degToRad;

// One curved blade per variant, shared by all leaves (scaled per leaf). Local frame: attachment
// at the origin, midrib along +Z, upper surface facing +Y.
function bladeGeometry(seed: number, cup: number) {
  const size = 1 / LEAF_FRAC; // plane side for a leaf of length 1
  const g = new PlaneGeometry(size, size, 22, 30);
  const p = g.attributes.position;
  const yOff = size * (ATTACH.y - 0.5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i) + yOff; // 0 at the sinus, 1 at the tip
    const ax = Math.abs(x);
    let h = -0.05 * Math.sqrt(x * x + 0.002); // soft fold along the midrib
    h -= cup * x * x; // halves droop toward the margin
    h -= 0.2 * Math.max(0, y) ** 2; // tip arches down
    h += 0.04 * Math.max(0, -y); // basal lobes lift a little
    h += 0.012 * Math.sin(y * 17 + seed) * (ax / 0.45) ** 2; // wavy margin
    h += 0.03 * x * y * Math.sin(seed); // slight twist
    p.setXYZ(i, -x, h, y);
  }
  g.computeVertexNormals();
  return g;
}

export default function Monstera({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  const { leaf, stemColor } = profile.morphology;
  const scale = state.heightCm / 100 / DESIGN_HEIGHT;
  const count = MathUtils.clamp(state.leafCount, 3, MAX_LEAVES);
  const wilt = state.wilt;
  // leaf length at scale 1 so the profile's lengthCm matches the biggest leaf at month 0
  const leafLen = 1.2 * (leaf.lengthCm / 100) * (DESIGN_HEIGHT / (profile.morphology.currentHeightCm / 100));

  const blades = useMemo(() => [0, 1, 2, 3, 4].map((v) => bladeGeometry(v * 1.7, 0.18 + wilt * 0.35)), [wilt]);

  const leaves = useMemo(
    () =>
      SPECS.slice(0, count).map((s, i) => {
        const a = deg(s.az);
        const out = new Vector3(Math.sin(a), 0, Math.cos(a));
        const reach = s.reach * (1 + wilt * 0.25);
        const h = s.h * (1 - wilt * 0.3);
        const base = out.clone().multiplyScalar(0.015 + 0.01 * (i % 3));
        const end = out.clone().multiplyScalar(reach).setY(h);
        // rise steeply first, then arch outward into the blade
        const c1 = base.clone().add(new Vector3(0, h * 0.55, 0)).addScaledVector(out, reach * 0.18);
        const c2 = end.clone().addScaledVector(out, -reach * 0.5).add(new Vector3(0, h * 0.1 * (1 - wilt), 0));
        const curve = new CubicBezierCurve3(base, c1, c2, end);
        const thick = 0.011 * Math.sqrt(s.size);
        return {
          s,
          end,
          a,
          petiole: taperedTube(curve, thick, thick * 0.55),
        };
      }),
    [count, wilt],
  );

  const leafColor = useMemo(() => new Color(leaf.color), [leaf.color]);
  const colors = useMemo(
    () =>
      SPECS.map((s, i) => {
        // texture already carries the green; tint gently: young leaves lighter/yellower, wilt toward olive
        const c = new Color("#ffffff").lerp(new Color("#d6f0a0"), s.young * 0.5);
        c.multiply(new Color(1, 1, 1).lerp(leafColor.clone().multiplyScalar(3.2), 0.35));
        c.offsetHSL((i % 3) * 0.008 - 0.008, 0, (i % 2) * 0.03);
        return c.lerp(new Color("#e0c872"), wilt * 0.6);
      }),
    [leafColor, wilt],
  );

  const sway = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sway.current.forEach((g, i) => {
      if (g) g.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.02;
    });
  });

  return (
    <group scale={scale}>
      {/* crown where the petioles emerge */}
      <mesh position={[0, 0.01, 0]} castShadow>
        <sphereGeometry args={[0.035, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={stemColor} roughness={0.7} />
      </mesh>
      {leaves.map(({ s, end, a, petiole }, i) => (
        <group key={i}>
          <mesh geometry={petiole} castShadow receiveShadow>
            <meshStandardMaterial color={new Color(stemColor).lerp(new Color("#7fa04a"), 0.25 + s.young * 0.2)} roughness={0.5} />
          </mesh>
          <group position={end} rotation={[0, a, 0]}>
            <group ref={(g) => void (sway.current[i] = g)}>
              <group rotation={[-deg(s.pitch) + deg(40) * wilt, 0, deg(s.roll)]}>
                <mesh geometry={blades[s.v]} scale={leafLen * s.size} castShadow receiveShadow>
                  <meshStandardMaterial
                    map={leafTextures(s.v).map}
                    bumpMap={leafTextures(s.v).bump}
                    bumpScale={1.5}
                    color={colors[i]}
                    alphaTest={0.5}
                    side={DoubleSide}
                    roughness={0.62}
                    emissive="#0c1f0e"
                    emissiveIntensity={0.6}
                    metalness={0}
                  />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}
