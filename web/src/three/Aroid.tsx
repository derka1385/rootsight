import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, CubicBezierCurve3, CylinderGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { coirTexture } from "./textures";
import type { PlantRenderSpec } from "./renderSpec";
import { segmentMatrix } from "./architecture";
import { clamp01, seededRandom, smoothstep } from "./procedural";
import { leafAlbedo, leafGeometry, leafMaterial, leafNormal, venation, type LeafShape } from "./leafSystem";

/*
 * Monstera-type aroid. One or more crowns grow from a basal growth point; each new leaf comes from
 * the newest node on a short, thickening stem, rides a long tapered petiole that rises and arches
 * out, and unfurls from a rolled spike. Leaves are heteroblastic: each keeps the form maturity it
 * was born with, so the oldest (lowest, outermost) are small and entire and the newest are large and
 * fenestrated. Past the stage's leaf budget the oldest leaves yellow and are shed.
 */

/** Form-maturity levels that get their own painted texture + blade geometry. */
const LEVELS = [0.05, 0.3, 0.5, 0.7, 0.9];
const CAPACITY = 24, PETIOLE_SEGS = 10;
const SEG = new CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
const UP = new Vector3(0, 1, 0);
const POLE = new CylinderGeometry(1, 1.05, 1, 20, 1).translate(0, 0.5, 0);

type Shown = { count: number; wilt: number; height: number };

function shapeFor(level: number, spec: PlantRenderSpec, i: number): LeafShape {
  const r = seededRandom(`${spec.seed}:shape:${i}`);
  return {
    // Juvenile leaves are narrower hearts; adult blades are broad with deep basal lobes.
    widthToLength: spec.leaf.widthToLength * (0.9 + 0.1 * level),
    widest: 0.32 + 0.06 * r(), baseWidth: 0.5 + 0.2 * level, lobe: 0.04 + 0.1 * level, acumen: 0.55 - 0.25 * level,
    asymmetry: (r() - 0.5) * 0.18, arch: 0.1 + 0.12 * level + r() * 0.05, cup: 0.35 + 0.35 * level, fold: 0.22 - 0.14 * level,
    undulation: 0.006 + 0.01 * level, twist: (r() - 0.5) * 0.12, seed: `${spec.seed}:${i}`,
  };
}

export default function Aroid({ spec }: { spec: PlantRenderSpec }) {
  const invalidate = useThree(s => s.invalidate);
  const variant = `${spec.seed}|${spec.leaf.color}|${spec.leaf.gloss}|${spec.visual.leaves.fenestration}|${spec.leaf.widthToLength}|${spec.leaf.variegation}|${spec.leaf.brownTips}`;
  const res = useMemo(() => {
    const ven = venation(spec.seed, 7);
    const normal = leafNormal(ven);
    const blades = LEVELS.map((level, i) => {
      const map = leafAlbedo({
        // The photo's fenestration says how mature today's leaves are; the species can always split.
        seed: spec.seed, formMaturity: level, fenestration: Math.max(0.8, spec.visual.leaves.fenestration), color: spec.leaf.color, venation: ven, brownTips: spec.leaf.brownTips,
        variegation: { kind: spec.leaf.variegation, amount: spec.leaf.variegationAmount, color: spec.leaf.variegationColor },
      });
      const geometry = leafGeometry(shapeFor(level, spec, i));
      geometry.setAttribute("aRoll", new InstancedBufferAttribute(new Float32Array(CAPACITY), 1));
      return { geometry, map, ...leafMaterial(map, normal, { gloss: spec.leaf.gloss, underside: spec.leaf.undersideColor }) };
    });
    const petiole = new MeshStandardMaterial({ color: new Color(spec.leaf.color).lerp(new Color("#9dbb5a"), 0.35), roughness: 0.42 });
    const stem = new MeshStandardMaterial({ color: new Color(spec.stem.color).lerp(new Color("#5b5a3a"), 0.35), roughness: 0.7 });
    const aerial = new MeshStandardMaterial({ color: "#6e5139", roughness: 0.85 });
    const pole = new MeshStandardMaterial({ map: coirTexture(), bumpMap: coirTexture(), bumpScale: 2, roughness: 1 });
    return { normal, blades, petiole, stem, aerial, pole };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);
  useEffect(() => () => {
    res.normal.dispose();
    res.blades.forEach(b => { b.geometry.dispose(); b.map.dispose(); b.material.dispose(); b.depth.dispose(); });
    [res.petiole, res.stem, res.aerial, res.pole].forEach(m => m.dispose());
  }, [res]);

  const leafMeshes = useRef<(InstancedMesh | null)[]>([]);
  const petioleMesh = useRef<InstancedMesh>(null);
  const stemMesh = useRef<InstancedMesh>(null);
  const aerialMesh = useRef<InstancedMesh>(null);
  const poleMesh = useRef<Mesh>(null);
  const shown = useRef<Shown | null>(null);
  const target: Shown = { count: spec.leafCount, wilt: spec.wilt, height: spec.heightM };

  const apply = (s: Shown) => {
    const layout = aroidLayout(spec, s);
    res.blades.forEach((_, b) => {
      const mesh = leafMeshes.current[b];
      if (!mesh) return;
      const poses = layout.leaves.filter(l => l.level === b);
      const roll = mesh.geometry.getAttribute("aRoll") as InstancedBufferAttribute;
      poses.forEach((pose, i) => { mesh.setMatrixAt(i, pose.matrix); mesh.setColorAt(i, pose.color); roll.setX(i, pose.roll); });
      mesh.count = poses.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      roll.needsUpdate = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    });
    const pole = poleMesh.current;
    if (pole) {
      pole.visible = !!layout.pole;
      if (layout.pole) { pole.position.copy(layout.pole.position).setY(-0.05); pole.scale.set(layout.pole.radius, layout.pole.height + 0.05, layout.pole.radius); }
    }
    for (const [ref, list] of [[petioleMesh, layout.petioles], [stemMesh, layout.stem], [aerialMesh, layout.aerial]] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    }
  };

  // First paint and resource swaps apply synchronously, so the camera can measure the real plant.
  useLayoutEffect(() => {
    // Instance colours must exist before the first compile so the shader includes them.
    leafMeshes.current.forEach(mesh => { for (let i = 0; i < CAPACITY; i++) mesh?.setColorAt(i, new Color(1, 1, 1)); });
    shown.current ??= { ...target };
    apply(shown.current);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);
  useEffect(() => { invalidate(); }, [spec, invalidate]);

  // Growth and watering changes glide: new leaves visibly emerge and unfurl, wilt eases in/out.
  useFrame((_, delta) => {
    const s = shown.current;
    if (!s) return;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 4.5);
    let changed = false, moving = false;
    for (const key of ["count", "wilt", "height"] as const) {
      const d = target[key] - s[key];
      if (d === 0) continue;
      changed = true;
      if (Math.abs(d) > 1e-3) { s[key] += d * k; moving = true; } else s[key] = target[key];
    }
    if (changed) apply(s);
    if (moving) invalidate();
  });

  return <group>
    {res.blades.map((b, i) => (
      <instancedMesh key={i} ref={m => void (leafMeshes.current[i] = m)} args={[b.geometry, b.material, CAPACITY]} customDepthMaterial={b.depth} castShadow receiveShadow frustumCulled={false} dispose={null} />
    ))}
    <instancedMesh ref={petioleMesh} args={[SEG, res.petiole, CAPACITY * PETIOLE_SEGS]} castShadow receiveShadow frustumCulled={false} dispose={null} />
    <instancedMesh ref={stemMesh} args={[SEG, res.stem, 4 * 40]} castShadow receiveShadow frustumCulled={false} dispose={null} />
    <instancedMesh ref={aerialMesh} args={[SEG, res.aerial, 8 * 12]} castShadow frustumCulled={false} dispose={null} />
    <mesh ref={poleMesh} geometry={POLE} material={res.pole} visible={false} scale={0.001} castShadow receiveShadow />
  </group>;
}

type LeafPose = { matrix: Matrix4; roll: number; color: Color; level: number };

/** Pure: same spec and shown values, same plant. No Math.random, no rounded counts. */
export function aroidLayout(spec: PlantRenderSpec, shown: Shown) {
  // Match the simulated height: a small plant shortens its petioles, a tall one climbs on its stem.
  const first = layoutPass(spec, shown, 1, 0);
  const fit = Math.min(1.3, Math.max(0.55, shown.height / Math.max(0.02, first.top)));
  const second = layoutPass(spec, shown, fit, 0);
  return second.top >= shown.height ? second : layoutPass(spec, shown, fit, shown.height - second.top);
}

/** The default camera looks from this azimuth; the oldest leaf is turned away from it. */
const CAMERA_AZ = Math.atan2(1.6, 2.4);

function layoutPass(spec: PlantRenderSpec, shown: Shown, fit: number, climb: number) {
  const { today } = spec, c = Math.max(0.001, shown.count), wilt = shown.wilt;
  const crowns = Math.max(1, Math.min(4, spec.stem.count));
  const potR = spec.pot.radius || 0.1;
  const internode = Math.max(0.006, spec.visual.stems.internodeCm / 100 * 0.3) * Math.sqrt(fit);
  const droop = spec.leaf.droop;
  const leaves: LeafPose[] = [], petioles: Matrix4[] = [], stem: Matrix4[] = [], aerial: Matrix4[] = [];
  let top = 0;

  const crownBase = Array.from({ length: crowns }, (_, k) => {
    const r = seededRandom(`${spec.seed}:crown:${k}`);
    const a = k * 2.39996 + r() * 0.6, d = crowns > 1 ? potR * (0.2 + 0.25 * r()) : 0;
    return { base: new Vector3(Math.sin(a) * d, -0.005, Math.cos(a) * d), phase: CAMERA_AZ + 2 + k * 1.3 + r() * 0.6, lean: new Vector3(Math.sin(a + 0.4), 0, Math.cos(a + 0.4)).multiplyScalar(0.12 + 0.18 * r()) };
  });
  // A tall plant climbs a moss pole, so its stem stays upright; a small one leans and curves freely.
  const poleHeight = climb > 0.12 ? climb + internode * 3 : 0;
  const leanScale = 1 / (1 + climb * 12);
  const stemPoint = (k: number, h: number) => crownBase[k].base.clone().addScaledVector(UP, h).addScaledVector(crownBase[k].lean, (h * 0.6 + h * h * 1.2) * leanScale);
  const stemR = spec.stem.thicknessM / 2 * (0.9 + 1.2 * spec.maturity);

  const firstLeaf = Math.max(0, Math.floor(c - spec.maxLeaves - 1));
  const topNode = Math.max(1, Math.floor((Math.ceil(c + 0.6) - 1) / crowns));
  const highestNode = new Array<number>(crowns).fill(0);
  // Leaves seen in the photo are fully open today; later ones emerge as a rolled spike and unfurl.
  for (let i = firstLeaf; i < Math.ceil(c + 0.6); i++) {
    const age = c - i + (i < today.leafCount ? 0.6 : 0);
    const shed = clamp01(c - spec.maxLeaves - i);
    if (shed >= 1 || age <= 1e-3) continue;
    const emerge = smoothstep(0, 0.25, age); // a new leaf grows from nothing, never pops in
    const r = seededRandom(`${spec.seed}:leaf:${i}`);
    const rr = [r(), r(), r(), r(), r(), r()];
    const k = i % crowns, j = Math.floor(i / crowns);
    // Each leaf keeps the form and size it was born with: older leaves are more juvenile.
    const born = spec.leafAt(i), form = born.form;
    const length = born.lengthM * (1 + (rr[0] - 0.5) * spec.leaf.sizeVariation * 0.6);
    const expand = smoothstep(0, 1.1, age), unfurl = smoothstep(0.2, 1.25, age);
    const youth = 1 - clamp01((age - 1) / Math.max(3, spec.maxLeaves * 0.7));

    const nodeH = j * internode + climb * (j / topNode) ** 1.2;
    highestNode[k] = Math.max(highestNode[k], nodeH);
    const node = stemPoint(k, nodeH);
    const az = crownBase[k].phase + j * 2.51 + (rr[1] - 0.5) * 0.7;
    const out = new Vector3(Math.sin(az), 0, Math.cos(az));

    // Petiole: rises from the node, then arches out; older leaves reach lower and further.
    const pl = length * (0.85 + 0.3 * rr[2]) * (0.2 + 0.8 * smoothstep(0, 0.8, age)) * emerge * fit;
    let el = 0.3 + 0.95 * youth + (rr[3] - 0.5) * 0.25 - wilt * 0.8 - droop * 0.3 - shed * 0.5;
    el = Math.max(-0.45, el + (1.45 - el) * (1 - unfurl));
    const chord = out.clone().multiplyScalar(Math.cos(el)).addScaledVector(UP, Math.sin(el));
    const p3 = node.clone().addScaledVector(chord, pl * 0.95);
    const curve = new CubicBezierCurve3(
      node,
      node.clone().addScaledVector(UP, pl * 0.38),
      p3.clone().addScaledVector(chord, -pl * 0.32).addScaledVector(UP, pl * (0.1 - wilt * 0.3)),
      p3,
    );
    const pr = Math.max(0.0015, length * 0.019 * (0.5 + 0.5 * expand));
    const pts = curve.getPoints(PETIOLE_SEGS);
    for (let s = 0; s < PETIOLE_SEGS; s++) {
      // Winged sheath at the base, narrowing up to the blade.
      const radius = pr * (1 - 0.35 * s / PETIOLE_SEGS) * (s < 2 ? 1.6 - 0.3 * s : 1);
      petioles.push(segmentMatrix(pts[s], pts[s].clone().lerp(pts[s + 1], 1.04), radius));
    }

    // Blade: faces up and out, the newest held more upright; wilt and shedding let it hang.
    let pitch = -0.3 + 0.8 * youth ** 1.5 + (rr[4] - 0.5) * 0.5 - wilt * 1.05 - shed * 0.6 - droop * 0.4;
    pitch += (1.5 - pitch) * (1 - unfurl);
    const dir = out.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(UP, Math.sin(pitch));
    const side = new Vector3(Math.cos(az), 0, -Math.sin(az));
    const normal = dir.clone().cross(side);
    const basis = new Matrix4().makeBasis(side, normal, dir);
    const roll = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (rr[5] - 0.5) * 0.9);
    const size = length * (0.28 + 0.72 * expand) * emerge * (1 - 0.5 * smoothstep(0.7, 1, shed));
    const matrix = new Matrix4().compose(p3, new Quaternion().setFromRotationMatrix(basis).multiply(roll), new Vector3(size, size, size));
    const halfWidth = spec.leaf.widthToLength * 0.5;
    const curl = (1 - unfurl) * 2.9 / halfWidth - wilt * 1.7 - shed * 0.9;

    // New leaves are a lighter lime; the oldest yellows as it is shed; drought dulls everything.
    const color = new Color(1, 1, 1);
    color.lerp(new Color(1.18, 1.22, 0.72), (1 - smoothstep(0.6, 2.2, age)) * 0.7);
    const oldest = i === firstLeaf ? clamp01(spec.leaf.yellowing * today.leafCount) : 0;
    color.lerp(new Color(1.55, 1.3, 0.35), Math.max(shed, oldest));
    color.lerp(new Color(0.95, 0.9, 0.55), wilt * 0.45);

    let level = 0;
    LEVELS.forEach((l, b) => { if (Math.abs(l - form) < Math.abs(LEVELS[level] - form)) level = b; });
    leaves.push({ matrix, roll: curl, color, level });
    top = Math.max(top, p3.y + size * Math.max(0.15, Math.sin(pitch)) * 0.8);
  }

  // Stems: from the soil up to the newest node, thickening with age.
  crownBase.forEach((_, k) => {
    const h = highestNode[k] + internode * 0.5, n = Math.max(2, Math.min(30, Math.ceil(h / 0.012)));
    for (let s = 0; s < n; s++) stem.push(segmentMatrix(stemPoint(k, h * s / n), stemPoint(k, h * (s + 1.05) / n), stemR * (1 - 0.25 * s / n)));
    // Aerial roots appear from older nodes once the plant is adult, and reach down into the soil.
    const roots = Math.round(smoothstep(0.3, 0.7, spec.maturity) * 3 * Math.min(1, h / 0.06));
    for (let a = 0; a < roots; a++) {
      const r = seededRandom(`${spec.seed}:aerial:${k}:${a}`);
      const from = stemPoint(k, h * (0.35 + 0.4 * r()));
      const az = r() * 6.28, reach = 0.04 + 0.06 * r();
      const land = new Vector3(from.x + Math.sin(az) * reach, -0.01, from.z + Math.cos(az) * reach);
      const curve = new CubicBezierCurve3(from, from.clone().add(new Vector3(Math.sin(az) * reach * 0.8, 0.01, Math.cos(az) * reach * 0.8)), land.clone().add(new Vector3(0, from.y * 0.4, 0)), land);
      const pts = curve.getPoints(10);
      for (let s = 0; s < 10; s++) aerial.push(segmentMatrix(pts[s], pts[s].clone().lerp(pts[s + 1], 1.05), stemR * 0.32 * (1 - 0.3 * s / 10)));
    }
  });
  const behind = new Vector3(-Math.sin(CAMERA_AZ), 0, -Math.cos(CAMERA_AZ));
  const poleR = 0.018 + 0.012 * spec.maturity;
  const pole = poleHeight ? { position: crownBase[0].base.clone().addScaledVector(behind, poleR + stemR * 1.2), height: poleHeight, radius: poleR } : null;
  return { leaves, petioles, stem, aerial, pole, top };
}
