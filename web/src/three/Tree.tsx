import { useEffect, useMemo } from "react";
import { Color, CylinderGeometry, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { PlantRenderPlan } from "./renderPlan";
import { segmentMatrix } from "./architecture";
import { clamp01, seededRandom } from "./procedural";
import { leafAlbedo, leafGeometry, leafMaterial, leafNormal, venation } from "./leafSystem";
import { Instances } from "./Instances";

/*
 * Woody indoor trees (Ficus elastica/lyrata, Schefflera...): a tapered trunk that thickens and turns
 * to bark with age, branches that appear as the growth plan adds axes (alternating up the upper
 * trunk, angled out and curving up), sub-branches once branching gets dense, and alternate leaves on
 * short petioles along the young wood, largest in the middle of each shoot and held out and down.
 */

const SEG = new CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
const UP = new Vector3(0, 1, 0);
const GOLDEN = 2.39996;

type Shoot = { from: Vector3; dir: Vector3; length: number; radius: number; depth: number; seed: string };

export function treeLayout(plan: PlantRenderPlan) {
  const H = plan.heightM, s = plan.state;
  const wood: Matrix4[] = [], petioles: Matrix4[] = [], leaves: Matrix4[] = [];
  const trunkAxis = plan.axes[0];
  const lean = trunkAxis && trunkAxis.direction.lengthSq() > 0 ? trunkAxis.direction.clone().multiplyScalar(Math.sin(trunkAxis.leanRad)) : new Vector3();
  const trunkDir = UP.clone().add(lean).normalize();
  const trunkLen = H * 0.92;
  const trunkR = Math.max(0.003, s.stemThicknessMm / 2000);
  // Branches: one per extra axis, spread up the top half of the trunk, lowest longest.
  const branches = Math.max(0, Math.round(s.axes) - 1);
  const shoots: Shoot[] = [{ from: new Vector3(0, -0.01, 0), dir: trunkDir, length: trunkLen, radius: trunkR, depth: 0, seed: "trunk" }];
  const halfCanopy = Math.max(0.05, plan.canopyWidthM / 2);
  for (let b = 0; b < branches; b++) {
    const r = seededRandom(`${plan.seed}:branch:${b}`);
    const t = 0.45 + 0.45 * (b + 0.5) / branches + (r() - 0.5) * 0.06;
    const az = b * GOLDEN + r() * 0.5;
    const out = new Vector3(Math.sin(az), 0, Math.cos(az));
    const dir = out.clone().multiplyScalar(0.85).addScaledVector(UP, 0.7 + 0.3 * r()).normalize();
    shoots.push({ from: trunkDir.clone().multiplyScalar(trunkLen * t).setY(trunkLen * t * trunkDir.y - 0.01), dir, length: Math.min(halfCanopy * 1.2, H * (0.5 - 0.3 * t)) * (0.8 + 0.4 * r()), radius: trunkR * (0.45 - 0.15 * t), depth: 1, seed: `b${b}` });
  }
  // Dense branching: each branch forks once near its middle.
  if (s.branchingDensity > 0.5) for (const sh of shoots.filter(x => x.depth === 1)) {
    const r = seededRandom(`${plan.seed}:${sh.seed}:fork`);
    const side = new Vector3(r() - 0.5, 0.4, r() - 0.5).normalize();
    shoots.push({ from: sh.from.clone().addScaledVector(sh.dir, sh.length * 0.55), dir: sh.dir.clone().add(side).normalize(), length: sh.length * 0.55, radius: sh.radius * 0.55, depth: 2, seed: `${sh.seed}f` });
  }
  // Wood: each shoot curves upward (phototropism) and tapers; a thin trunk stays green at the top.
  const pointOf = (sh: Shoot, t: number) => sh.from.clone().addScaledVector(sh.dir, sh.length * t).addScaledVector(UP, sh.depth ? sh.length * 0.18 * t * t : 0);
  for (const sh of shoots) {
    const n = Math.max(3, Math.ceil(sh.length / 0.03));
    for (let i = 0; i < n; i++) {
      const a = pointOf(sh, i / n), b = pointOf(sh, (i + 1) / n);
      wood.push(segmentMatrix(a, a.clone().lerp(b, 1.03), sh.radius * (1 - 0.55 * i / n)));
    }
  }
  // Leaves: dealt to shoots by the length of young wood they carry, alternate along the outer part.
  const leafy = shoots.map(sh => ({ sh, weight: sh.length * (sh.depth === 0 ? (branches ? 0.45 : 1) : 1) }));
  const total = leafy.reduce((t, x) => t + x.weight, 0);
  const leafLen = Math.max(0.02, s.leafLengthCm / 100);
  for (const { sh, weight } of leafy) {
    const count = s.leaves * weight / total;
    const start = sh.depth === 0 ? (branches ? 0.5 : 0.25) : 0.25;
    for (let i = 0; i < Math.ceil(count); i++) {
      const grow = clamp01(count - i);
      if (grow <= 0) continue;
      const r = seededRandom(`${plan.seed}:${sh.seed}:leaf:${i}`);
      const t = start + (1 - start) * (i + 0.5) / Math.max(1, count);
      const node = pointOf(sh, Math.min(1, t));
      const az = i * GOLDEN + (sh.depth ? 1.3 : 0) + (r() - 0.5) * 0.4;
      const out = new Vector3(Math.sin(az), 0, Math.cos(az));
      // Young leaves at the tip point up; older ones held out and slightly down; drought lets them hang.
      const tipYouth = clamp01((t - 0.75) / 0.25);
      const pitch = -0.25 + 1.1 * tipYouth + (r() - 0.5) * 0.3 - plan.wilt * 1.1 - plan.leaf.droop * 0.4;
      const d = out.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(UP, Math.sin(pitch));
      const size = leafLen * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.05))) * (0.85 + 0.3 * r()) * grow;
      const petiole = node.clone().addScaledVector(d, size * 0.12);
      petioles.push(segmentMatrix(node, petiole, Math.max(0.0012, sh.radius * 0.25)));
      const side = new Vector3(Math.cos(az), 0, -Math.sin(az));
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, d.clone().cross(side), d));
      leaves.push(new Matrix4().compose(petiole, q, new Vector3(size, size, size)));
    }
  }
  return { wood, petioles, leaves };
}

export default function Tree({ plan }: { plan: PlantRenderPlan }) {
  // Bark colour follows woodiness: green-brown young stems become grey-brown trunks.
  const woodiness = clamp01(plan.state.stemThicknessMm / Math.max(1, plan.stem.thicknessM * 1000 * 2));
  const res = useMemo(() => {
    const ven = venation(plan.seed, 9);
    const normal = leafNormal(ven);
    const map = leafAlbedo({ seed: plan.seed, formMaturity: 1, fenestration: 0, color: plan.leaf.color, venation: ven, brownTips: plan.leaf.brownTips, variegation: { kind: plan.leaf.variegation, amount: plan.leaf.variegationAmount, color: plan.leaf.variegationColor } });
    const geometry = leafGeometry({ widthToLength: plan.leaf.widthToLength, widest: 0.45, baseWidth: 0.2, lobe: 0, acumen: 0.4, asymmetry: 0.04, arch: 0.12, cup: 0.25, fold: 0.08, undulation: 0.004, twist: 0.05, seed: plan.seed }, 30, 5);
    const { material, depth } = leafMaterial(map, normal, { gloss: plan.leaf.gloss, underside: plan.leaf.undersideColor });
    depth.dispose();
    const bark = new MeshStandardMaterial({ color: new Color(plan.stem.color).lerp(new Color("#6f6556"), 0.3 + 0.6 * woodiness), roughness: 0.85 });
    const petiole = new MeshStandardMaterial({ color: new Color(plan.stem.color).lerp(new Color(plan.leaf.color), 0.4), roughness: 0.6 });
    return { geometry, map, normal, material, bark, petiole };
  }, [plan.seed, plan.leaf.color, plan.leaf.gloss, plan.leaf.widthToLength, plan.leaf.variegation, plan.leaf.brownTips, plan.stem.color, woodiness]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { res.geometry.dispose(); res.map.dispose(); res.normal.dispose(); res.material.dispose(); res.bark.dispose(); res.petiole.dispose(); }, [res]);
  const layout = useMemo(() => treeLayout(plan), [plan]);
  return <group>
    <Instances geometry={SEG} material={res.bark} matrices={layout.wood} capacity={1500} />
    <Instances geometry={SEG} material={res.petiole} matrices={layout.petioles} capacity={400} />
    <Instances geometry={res.geometry} material={res.material} matrices={layout.leaves} capacity={400} />
  </group>;
}
