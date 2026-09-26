import { useEffect, useMemo } from "react";
import { Color, CylinderGeometry, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { PlantRenderPlan } from "./renderPlan";
import { segmentMatrix } from "./architecture";
import { clamp01, seededRandom } from "./procedural";
import { leafAlbedo, leafGeometry, leafMaterial, leafNormal, venation } from "./leafSystem";
import { Instances } from "./Instances";

/*
 * Cane plants (Dracaena, Yucca, Cordyline...): bare woody canes of different heights, ringed with old
 * leaf scars, each topped by a dense rosette of arching strap leaves. The canes, their heights and
 * lean come straight from the photo; growth lengthens them, adds leaves to each tuft and, at later
 * stages, new side shoots near the top.
 */

const SEG = new CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0);
const UP = new Vector3(0, 1, 0);
const GOLDEN = 2.39996;

export function caneLayout(plan: PlantRenderPlan) {
  const { wilt } = plan;
  const potR = plan.pot.radius || 0.1;
  const trunk: Matrix4[] = [], leaves: Matrix4[] = [];
  // Photographed canes, plus side shoots once the growth plan calls for more axes.
  const canes = plan.axes.map((a, i) => ({ ...a, parent: -1, index: i }));
  const extra = Math.max(0, Math.round(plan.stem.count) - canes.length);
  for (let e = 0; e < extra; e++) {
    const host = canes[e % canes.length];
    canes.push({ ...host, heightM: host.heightM * 0.25, thicknessM: host.thicknessM * 0.5, parent: host.index, index: canes.length, leanRad: 0.5 });
  }
  const tallest = Math.max(...canes.map(c => c.heightM), 0.01);
  const leafLen = plan.today.leafLengthM * Math.max(1, plan.state.leafLengthCm / 100 / plan.today.leafLengthM);
  // Leaves are dealt to the canes by size (taller canes carry fuller tufts), summing to the plan's count.
  const weight = (c: (typeof canes)[number]) => (c.parent >= 0 ? 0.6 : 1) * (0.7 + 0.6 * c.heightM / tallest);
  const totalWeight = canes.reduce((t, c) => t + weight(c), 0);
  const tips: Vector3[] = [];
  canes.forEach((cane, ci) => {
    const r = seededRandom(`${plan.seed}:cane:${ci}`);
    const dir = cane.direction.lengthSq() > 0 ? cane.direction.clone() : new Vector3(Math.sin(ci * GOLDEN), 0, Math.cos(ci * GOLDEN));
    const lean = new Vector3().addScaledVector(dir, Math.sin(cane.leanRad)).addScaledVector(UP, Math.cos(cane.leanRad)).normalize();
    let base: Vector3;
    if (cane.parent >= 0) base = tips[cane.parent].clone().addScaledVector(UP, -0.06 * tallest);
    else {
      const a = ci * GOLDEN + r();
      const d = canes.length > 1 ? potR * (0.15 + 0.35 * r()) : 0;
      base = new Vector3(Math.sin(a) * d, -0.01, Math.cos(a) * d);
    }
    // Woody cane: slightly curved, thinning upward, with a ring scar every few centimetres.
    const n = Math.max(3, Math.ceil(cane.heightM / 0.02));
    const bend = new Vector3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.08);
    const point = (t: number) => base.clone().addScaledVector(lean, cane.heightM * t).addScaledVector(bend, cane.heightM * t * t);
    const radius = Math.max(0.003, cane.thicknessM / 2);
    for (let s = 0; s < n; s++) {
      const a = point(s / n), b = point((s + 1) / n);
      const rr = radius * (1 - 0.25 * s / n);
      trunk.push(segmentMatrix(a, a.clone().lerp(b, 0.82), rr));
      trunk.push(segmentMatrix(a.clone().lerp(b, 0.82), b, rr * 1.07)); // leaf scar ring
    }
    const tip = point(1);
    tips.push(tip);
    // Rosette: oldest leaves low and drooping outward, newest upright in the centre.
    const count = Math.max(2, plan.state.leaves * weight(cane) / totalWeight);
    for (let i = 0; i < Math.ceil(count); i++) {
      const grow = clamp01(count - i);
      if (grow <= 0) continue;
      const rl = seededRandom(`${plan.seed}:cane:${ci}:leaf:${i}`);
      const t = Math.min(1, i / Math.max(1, count - 1)); // 0 outer/oldest .. 1 inner/newest
      const az = i * GOLDEN + ci * 1.1 + (rl() - 0.5) * 0.3;
      const out = new Vector3(Math.sin(az), 0, Math.cos(az));
      const pitch = -0.45 + 1.75 * t ** 0.8 + (rl() - 0.5) * 0.25 - wilt * 1.2 - plan.leaf.droop * 0.5;
      const d = out.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(UP, Math.sin(pitch));
      const side = new Vector3(Math.cos(az), 0, -Math.sin(az));
      const normal = d.clone().cross(side);
      const origin = tip.clone().addScaledVector(lean, -(1 - t) * Math.min(0.08, cane.heightM * 0.25));
      const size = leafLen * (0.55 + 0.45 * (1 - t) ** 0.5) * (0.85 + 0.3 * rl()) * grow;
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, normal, d));
      leaves.push(new Matrix4().compose(origin, q, new Vector3(size, size, size)));
    }
  });
  return { trunk, leaves };
}

export default function Cane({ plan }: { plan: PlantRenderPlan }) {
  const res = useMemo(() => {
    const ven = venation(plan.seed, 14);
    const normal = leafNormal(ven);
    const map = leafAlbedo({ seed: plan.seed, formMaturity: 1, fenestration: 0, color: plan.leaf.color, venation: ven, brownTips: plan.leaf.brownTips, variegation: { kind: plan.leaf.variegation, amount: plan.leaf.variegationAmount, color: plan.leaf.variegationColor } });
    const geometry = leafGeometry({
      widthToLength: Math.min(0.3, plan.leaf.widthToLength), widest: 0.45, baseWidth: 0.35, lobe: 0, acumen: 0.8,
      asymmetry: 0, arch: 0.28 + plan.leaf.droop * 0.3, cup: 0.1, fold: 0.35, undulation: 0.004, twist: 0.05, seed: plan.seed,
    }, 36, 3);
    const { material, depth } = leafMaterial(map, normal, { gloss: plan.leaf.gloss, underside: plan.leaf.undersideColor });
    depth.dispose();
    const bark = new MeshStandardMaterial({ color: new Color(plan.stem.color).lerp(new Color("#8a7458"), 0.5), roughness: 0.9 });
    return { geometry, map, normal, material, bark };
  }, [plan.seed, plan.leaf.color, plan.leaf.gloss, plan.leaf.widthToLength, plan.leaf.droop, plan.leaf.variegation, plan.leaf.brownTips, plan.stem.color]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { res.geometry.dispose(); res.map.dispose(); res.normal.dispose(); res.material.dispose(); res.bark.dispose(); }, [res]);
  const layout = useMemo(() => caneLayout(plan), [plan]);
  return <group>
    <Instances geometry={SEG} material={res.bark} matrices={layout.trunk} capacity={2000} />
    <Instances geometry={res.geometry} material={res.material} matrices={layout.leaves} capacity={600} />
  </group>;
}
