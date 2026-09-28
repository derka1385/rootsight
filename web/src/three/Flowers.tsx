import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import type { PlantState } from "@rootsight/shared/schema";
import type { FlowerShape, SpeciesFlowering } from "@rootsight/shared/schema";
import { stemGeometry } from "./StemGeometry";
import { seededRandom } from "./procedural";
import { thinTissue } from "./shading";
import { stemTexture } from "./textures";
import { bloomLayout, isCorolla, type BloomOrgan } from "./bloomLayout";
import type { RenderProfile as PlantProfile, Visual } from "./visual";

/*
 * Flower generator (render half): one instanced mesh per organ part (petals, centres, buds, fruits),
 * one merged mesh for the flower stalks. Petals are small cupped sheets fanned around each head at the
 * opening angle of the species' flower form; their base blends into the photographed centre colour.
 */

type Form = SpeciesFlowering["form"];
/** Opening angle from the flower's face axis (90 flat, over 90 swept back) and petal length / diameter. */
const FORMS: Record<Form, { open: number; length: number }> = {
  simple: { open: 80, length: 0.5 }, star: { open: 88, length: 0.52 }, daisy: { open: 84, length: 0.5 },
  cup: { open: 48, length: 0.5 }, bell: { open: 22, length: 0.72 }, trumpet: { open: 30, length: 0.75 },
  tubular: { open: 12, length: 0.8 }, double: { open: 76, length: 0.5 }, orchid: { open: 86, length: 0.5 },
  spathe: { open: 58, length: 0.95 }, reflexed: { open: 158, length: 0.62 },
};

/** Petal cross-section cup, tip curl (+ toward the flower's face, - flaring out) and margin ruffle per form. */
const PETAL: Record<Form, { cup: number; arch: number; ruffle: number; pointed: boolean }> = {
  simple: { cup: 0.22, arch: 0.06, ruffle: 0.02, pointed: false }, star: { cup: 0.12, arch: -0.04, ruffle: 0.01, pointed: true },
  daisy: { cup: 0.08, arch: -0.05, ruffle: 0, pointed: false }, cup: { cup: 0.45, arch: 0.14, ruffle: 0.02, pointed: false },
  bell: { cup: 0.5, arch: -0.08, ruffle: 0.02, pointed: false }, trumpet: { cup: 0.55, arch: -0.16, ruffle: 0.03, pointed: false },
  tubular: { cup: 0.6, arch: -0.05, ruffle: 0, pointed: false }, double: { cup: 0.35, arch: 0.1, ruffle: 0.04, pointed: false },
  orchid: { cup: 0.18, arch: 0.04, ruffle: 0.03, pointed: false }, spathe: { cup: 0.28, arch: -0.1, ruffle: 0.01, pointed: true },
  reflexed: { cup: 0.18, arch: 0.1, ruffle: 0.02, pointed: false },
};

/**
 * Unit petal: base at the origin, tip at z = 1, front face +y. A smooth sheet (18 x 12 quads) with a
 * narrow claw, a rounded (or pointed) blade widest past the middle, a cupped section and a curled tip.
 */
function petalGeometry(widthToLength: number, form: Form): BufferGeometry {
  const { cup, arch, ruffle, pointed } = PETAL[form];
  const ROWS = 18, COLS = 12, pos: number[] = [], uv: number[] = [], t01: number[] = [], index: number[] = [];
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS;
    const blade = Math.sin(Math.PI * Math.pow(t, 1.25));
    const w = widthToLength / 2 * Math.pow(Math.max(0, blade), pointed ? 0.85 : 0.5) * (0.3 + 0.7 * Math.pow(Math.min(1, t / 0.2), 0.8));
    for (let c = 0; c <= COLS; c++) {
      const s = c / COLS * 2 - 1;
      pos.push(s * w, cup * s * s * w + arch * t * t + ruffle * Math.sin(t * 8 + s * 1.3) * s * s * w, t);
      uv.push((s + 1) / 2, t);
      t01.push(t);
    }
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = r * (COLS + 1) + c, b = a + COLS + 1;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("petalUv", new Float32BufferAttribute(uv, 2));
  g.setAttribute("petalT", new Float32BufferAttribute(t01, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Closed bud: a teardrop along +z, radius 1 at its widest. */
function budGeometry(): BufferGeometry {
  const g = new SphereGeometry(1, 18, 14).rotateX(Math.PI / 2);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), taper = 1 - 0.55 * Math.max(0, z);
    p.setXYZ(i, p.getX(i) * taper, p.getY(i) * taper, z * 1.35);
  }
  g.computeVertexNormals();
  return g;
}

const SPHERE = new SphereGeometry(1, 16, 12);
const SPADIX = new CylinderGeometry(0.75, 1, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5);
/** A spine of a thorn-apple capsule: base at the origin, tip at z = 1. */
const SPINE = new ConeGeometry(1, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5);

/**
 * A surface of revolution around +z sampled on a (U+1) x (V+1) grid, wound so its front face is the
 * OUTSIDE (the corolla shader colours the back, i.e. the inside, with the flower's inner colour).
 */
function latheGeometry(U: number, V: number, point: (a: number, v: number) => Vector3, lobes: number): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], t01: number[] = [], index: number[] = [];
  for (let j = 0; j <= V; j++) for (let i = 0; i <= U; i++) {
    const p = point(i / U * Math.PI * 2, j / V);
    pos.push(p.x, p.y, p.z); uv.push(i / U * lobes, j / V); t01.push(j / V);
  }
  for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
    const p = j * (U + 1) + i, q = p + U + 1;
    index.push(p, p + 1, q, p + 1, q + 1, q);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("petalUv", new Float32BufferAttribute(uv, 2));
  g.setAttribute("petalT", new Float32BufferAttribute(t01, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** What the photo measured beyond the outline, with plain-trumpet defaults for profiles scanned before. */
export function corollaStyle(shape: FlowerShape, form: Form) {
  return { layers: shape.layers ?? (form === "double" ? 2 : 1), tail: shape.tipTail ?? 0.15, ribs: shape.ribs ?? 0.3, lobes: shape.lobes >= 2 ? shape.lobes : 5 };
}

/**
 * One fused corolla, length 1 along +z from its base, as a function of angle and height. A narrow tube
 * widens into the measured mouth (a funnel for low flare, a trumpet bell for high flare). It is plicate:
 * each lobe's midrib runs down the tube as a ridge with a fold between ridges, deepening toward the mouth,
 * and fine ribs between them. The rim is scalloped, one broad lobe per midrib rising to a small point
 * (where a tail starts), and its edge ruffles and rolls outward between the points. Radii come from the
 * photo's measurements relative to the flower's length.
 *
 * `layer` k > 0 is a corolla nested inside (hose-in-hose): a narrower tube inside the outer one, turned
 * half a lobe so its points fall between the outer ones, rising 15% further and opening a little wider.
 */
export function corollaModel(shape: FlowerShape, mouthDiameterCm: number, style: ReturnType<typeof corollaStyle>, layer = 0) {
  const L = shape.lengthCm, N = style.lobes, { ribs, tail } = style;
  const Rt = Math.max(0.012, shape.tubeDiameterCm / 2 / L) * (1 - 0.2 * layer), Rm = Math.max(Rt * 1.2, mouthDiameterCm / 2 / L) * (1 + 0.05 * layer);
  const f = Math.min(0.9, Math.max(0.05, shape.tubeFraction + 0.1 * layer)), F = Math.min(1, shape.flare + 0.08 * layer);
  const height = 1 + 0.15 * layer, turn = layer * Math.PI / N;
  const point = (a: number, v: number) => {
    const s = Math.max(0, (v - f) / (1 - f)), c = Math.cos(N * a), ridge = 0.5 + 0.5 * c;
    let r = v <= f ? Rt * (0.7 + 0.45 * v / f) : Rt * 1.15 + (Rm - Rt * 1.15) * Math.pow(s, 1 + 1.2 * F);
    let z = v;
    const rim = Math.max(0, (s - 0.45) / 0.55) ** 2, edge = Math.max(0, (s - 0.75) / 0.25) ** 2;
    // Plicate: sharp midrib ridges and a secondary fold between them, then fine ribs that fade on the limb.
    const pleat = 0.03 + ribs * (0.08 + 0.2 * Math.min(1, Math.max(0, (v - 0.15) / 0.85)) ** 1.5);
    r *= 1 + pleat * (0.75 * Math.sign(c) * Math.abs(c) ** 0.6 + 0.25 * Math.cos(2 * N * a)) + 0.012 * ribs * Math.cos(3 * N * a) * (1 - rim);
    // Scalloped rim: broad lobes, each rising to a small point at its midrib, sinuses set back.
    const lobe = 0.6 * ridge + 0.4 * ridge ** (8 + 24 * tail);
    z -= (1 - lobe) * 0.09 * rim * (1.25 - f);
    // Between the points the edge ruffles and rolls outward, showing the inner face.
    z += 0.035 * rim * Math.sin(2 * N * a) * (1 - lobe);
    r *= 1 + 0.06 * rim * Math.cos(3 * N * a) * (1 - lobe) + 0.06 * edge * (1 - lobe * 0.6);
    z -= (0.02 + F * F * 0.04) * edge * (1 - lobe);
    return new Vector3(Math.cos(a + turn) * r, Math.sin(a + turn) * r, z * height);
  };
  return { point, N, Rm, turn };
}

/** A lobe tip's slender tail: a tapered strand that leaves along the lobe and curls outward and back (+y). */
const TAIL = (() => {
  const points: Vector3[] = [], p = new Vector3();
  for (let i = 0; i <= 14; i++) {
    const s = i / 14, curl = 3.4 * s ** 1.7;
    points.push(p.clone());
    p.add(new Vector3(0.12 * Math.sin(s * 4), Math.sin(curl), Math.cos(curl)).normalize().multiplyScalar(1 / 14));
  }
  const g = stemGeometry([{ id: "tail", points, radius: 0.05, taper: 0.9, depth: 4 }]);
  const n = g.getAttribute("position").count;
  g.setAttribute("petalUv", new Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute("petalT", new Float32BufferAttribute(new Float32Array(n).fill(1), 1));
  return g;
})();

/**
 * Tubular calyx of a trumpet flower, length 1 along +z from the stalk: N-angled, closing onto the stalk
 * in a rounded base, widening a little upward and ending in short pointed teeth on its angles.
 */
function sheathGeometry(N: number) {
  return latheGeometry(N * 12, 22, (a, v) => {
    const ridge = 0.5 + 0.5 * Math.cos(N * a);
    const r = (v < 0.14 ? 0.45 + 0.55 * Math.sin(v / 0.14 * Math.PI / 2) : 1 + 0.1 * (v - 0.14)) * (1 + 0.1 * (ridge * ridge - 0.35));
    return new Vector3(Math.cos(a) * r, Math.sin(a) * r, v * (0.86 + 0.14 * ridge ** 3));
  }, N);
}

/** A furled trumpet bud, length 1 along +z from its base: a spindle with a pointed tip whose pleats twist shut. */
function furledBudGeometry(N: number) {
  return latheGeometry(N * 10, 32, (a, v) => {
    const r = (0.5 + 0.5 * Math.min(1, v / 0.5) ** 0.7) * Math.max(0, 1 - v ** 3) ** 0.6 * (1 + (0.04 + 0.14 * v) * Math.cos(N * (a + 1.1 * v)));
    return new Vector3(Math.cos(a) * r, Math.sin(a) * r, v);
  }, N);
}
const BUD = budGeometry();
/**
 * Calyx / receptacle: a truncated cone from the stalk end (origin, radius 0.28 so it is as thick as the
 * stalk there: a continuous junction, no pinch) to its rim inside the petals at z = 1.
 */
const CALYX = new CylinderGeometry(0.28, 1, 1, 14).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
const Z = new Vector3(0, 0, 1);
const UP = new Vector3(0, 1, 0);

type Instance = { matrix: Matrix4; color: Color };

/** Frame whose +z is `axis` and whose +y is as close as possible to `up`. */
function basis(axis: Vector3, up: Vector3) {
  const side = new Vector3().crossVectors(up, axis);
  if (side.lengthSq() < 1e-8) side.crossVectors(Math.abs(axis.y) > 0.9 ? new Vector3(1, 0, 0) : UP, axis);
  side.normalize();
  const y = new Vector3().crossVectors(axis, side);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, y, axis));
}

export function flowerInstances(organs: BloomOrgan[], flowering: SpeciesFlowering, colors: { flower: string; center: string; bud: string; fruit: string }, seed: string, wilt: number, shape?: FlowerShape, fruitSurface?: string) {
  const sheaths: Instance[] = [], tails: Instance[] = [], furled: Instance[] = [], spines: Instance[] = [];
  const fused = isCorolla(shape, flowering.form);
  const petals: Instance[] = [], centres: Instance[] = [], buds: Instance[] = [], fruits: Instance[] = [], spadices: Instance[] = [], calyces: Instance[] = [];
  const white = new Color(1, 1, 1);
  const style = fused ? corollaStyle(shape!, flowering.form) : undefined;
  const firstFlower = organs.find(o => o.kind === "flower");
  const models = fused && firstFlower ? Array.from({ length: style!.layers }, (_, k) => corollaModel(shape!, firstFlower.size / firstFlower.length * shape!.lengthCm, style!, k)) : [];
  const corollas: Instance[][] = models.map(() => []);
  // The green cup that joins the stalk to the organ: from the stalk end to just inside the petals or bud.
  const calyx = (o: BloomOrgan, reach: number, radius: number) => {
    const length = o.base.distanceTo(o.position) * reach + o.size * 0.02;
    calyces.push({ matrix: new Matrix4().compose(o.base, basis(o.facing, UP), new Vector3(o.size * radius, o.size * radius, length)), color: white });
  };
  const form = FORMS[flowering.form];
  const petalCount = flowering.form === "spathe" ? 1 : Math.max(3, flowering.form === "daisy" ? Math.max(13, flowering.petals) : flowering.petals || 5);
  const flower = new Color(colors.flower), center = new Color(colors.center);
  for (const o of organs) {
    const r = seededRandom(`${seed}:bloom-organ:${o.id}`);
    if (o.kind === "bud") {
      const tint = new Color(colors.bud).offsetHSL(0, 0, (r() - 0.5) * 0.06);
      if (fused) {
        // A furled trumpet: a twisted, pleated spindle as long as measured, its lower part in the calyx.
        const width = Math.max(o.size * 0.08, shape!.tubeDiameterCm / 200 * 1.1), roll = basis(o.facing, UP).multiply(new Quaternion().setFromAxisAngle(Z, r() * 6.28));
        furled.push({ matrix: new Matrix4().compose(o.base, roll, new Vector3(width, width, o.length)), color: tint });
        if (shape!.calyxLengthCm > 0) sheaths.push({ matrix: new Matrix4().compose(o.base, roll, new Vector3(width * 1.2, width * 1.2, Math.min(o.length * 0.55, shape!.calyxLengthCm / 100 * 0.8))), color: white });
        else calyx(o, 0.4, 0.2);
        continue;
      }
      buds.push({ matrix: new Matrix4().compose(o.position, basis(o.facing, UP), new Vector3(o.size * 0.3, o.size * 0.3, o.length / 2.7)), color: tint });
      calyx(o, 0.55, 0.24);
      continue;
    }
    if (o.kind === "fruit") {
      const R = o.size / 2, color = new Color(colors.fruit).offsetHSL(0, 0, (r() - 0.5) * 0.05);
      const q = basis(o.facing, UP), spiny = fruitSurface === "spiny";
      // A thorn-apple capsule is a little longer than wide and set with stout spines all over.
      fruits.push({ matrix: new Matrix4().compose(o.position, q, new Vector3(R, R, spiny ? R * 1.12 : R)), color });
      if (spiny) for (let k = 0, M = 72; k < M; k++) {
        const y = 1 - 2 * (k + 0.5) / M, ring = Math.sqrt(1 - y * y), phi = k * 2.399963;
        const local = new Vector3(Math.cos(phi) * ring, Math.sin(phi) * ring, y);
        if (local.z < -0.8) continue; // not through the stalk
        const dir = local.clone().applyQuaternion(q);
        spines.push({ matrix: new Matrix4().compose(o.position.clone().add(new Vector3(local.x * R, local.y * R, local.z * R * 1.12).multiplyScalar(0.94).applyQuaternion(q)), basis(dir, UP), new Vector3(R * 0.08, R * 0.08, R * (0.22 + r() * 0.1))), color: color.clone().offsetHSL(0, 0, 0.04) });
      }
      continue;
    }
    if (fused) {
      // One continuous corolla from the calyx to the flaring mouth; nested corollas (hose-in-hose) each rise
      // a little further out of the one around them. A tail curls from every lobe tip; a calyx covers the base.
      const frame = basis(o.facing, UP).multiply(new Quaternion().setFromAxisAngle(Z, r() * 6.28));
      const scale = new Vector3().setScalar(o.length);
      models.forEach((model, k) => {
        const tint = new Color(colors.flower).offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.05 + k * 0.03);
        const layer = new Matrix4().compose(o.base, frame, scale);
        corollas[k].push({ matrix: layer, color: tint });
        if (style!.tail > 0.05) for (let i = 0; i < model.N; i++) {
          const a = i / model.N * Math.PI * 2, tip = model.point(a, 1), along = tip.clone().sub(model.point(a, 0.96)).normalize();
          const out = new Vector3(Math.cos(a + model.turn), Math.sin(a + model.turn), 0), twist = new Quaternion().setFromAxisAngle(Z, (r() - 0.5) * 1.4);
          const length = style!.tail * model.Rm * 0.7 * (0.8 + r() * 0.4);
          tails.push({ matrix: layer.clone().multiply(new Matrix4().compose(tip, basis(along, out).multiply(twist), new Vector3().setScalar(length))), color: tint.clone().offsetHSL(0, 0, -0.07) });
        }
      });
      const tubeR = shape!.tubeDiameterCm / 200 * (o.length / (shape!.lengthCm / 100));
      if (shape!.calyxLengthCm > 0) sheaths.push({ matrix: new Matrix4().compose(o.base, frame, new Vector3(tubeR * 1.3, tubeR * 1.3, Math.min(o.length * 0.6, shape!.calyxLengthCm / 100 * (o.length / (shape!.lengthCm / 100))))), color: white });
      else calyx(o, 0.4, 0.1);
      continue;
    }
    // Petals fan around the face axis; drought closes and droops them a little.
    const F = o.facing.clone().normalize();
    const u = new Vector3().crossVectors(F, Math.abs(F.y) > 0.9 ? new Vector3(1, 0, 0) : UP).normalize();
    const w = new Vector3().crossVectors(F, u);
    const tint = flower.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06);
    const rings = flowering.form === "double" ? 2 : 1;
    // Structured, not random: evenly spaced petals, a shared twist (strong on swept-back forms), tiny jitter.
    const twist = new Quaternion().setFromAxisAngle(Z, flowering.form === "reflexed" ? 0.38 : 0.08);
    calyx(o, 1, flowering.form === "spathe" ? 0.06 : 0.11);
    for (let ring = 0; ring < rings; ring++) {
      const phase = r() * Math.PI * 2 + ring * Math.PI / petalCount;
      for (let i = 0; i < petalCount; i++) {
        const phi = phase + (i / petalCount) * Math.PI * 2 + (r() - 0.5) * 0.06;
        const plane = u.clone().multiplyScalar(Math.cos(phi)).addScaledVector(w, Math.sin(phi));
        // Drought closes cup-like flowers a little; swept-back petals just stay as they are (the head nods instead).
        const open = (form.open - ring * 30 + (r() - 0.5) * 5) * (form.open <= 90 ? 1 - wilt * 0.25 : 1) * Math.PI / 180;
        const axis = F.clone().multiplyScalar(Math.cos(open)).addScaledVector(plane, Math.sin(open)).normalize();
        // Orchids: the lower petal is the broad lip.
        const lip = flowering.form === "orchid" && i === 0 ? 1.35 : 1;
        const length = o.size * form.length * (ring ? 0.72 : 1) * lip * (0.97 + r() * 0.06);
        const base = o.position.clone().addScaledVector(plane, o.size * 0.05);
        petals.push({ matrix: new Matrix4().compose(base, basis(axis, F).multiply(twist), new Vector3().setScalar(length)), color: tint });
      }
    }
    if (flowering.form === "spathe") spadices.push({ matrix: new Matrix4().compose(o.position, basis(F.clone().lerp(UP, 0.4).normalize(), UP), new Vector3(o.size * 0.05, o.size * 0.05, o.size * 0.5)), color: center });
    else centres.push({ matrix: new Matrix4().compose(o.position.clone().addScaledVector(F, o.size * 0.03), new Quaternion(), new Vector3().setScalar(o.size * (flowering.form === "daisy" ? 0.16 : 0.08))), color: center });
  }
  return { petals, centres, buds, fruits, spadices, calyces, corollas, sheaths, tails, furled, spines };
}

/** Instanced part with per-instance colours; remounts when its capacity changes. */
function Part({ geometry, material, items }: { geometry: BufferGeometry; material: MeshStandardMaterial; items: Instance[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((item, i) => { mesh.setMatrixAt(i, item.matrix); mesh.setColorAt(i, item.color); });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow dispose={null} />;
}

/**
 * The fused corolla's surface. Outside: pale at the base (the photographed base colour), the flower colour
 * running up the tube in fine veins before it floods the throat and limb, paler lines left between the veins
 * of a ribbed tube. Inside (back faces): the inner colour in the throat, the flower colour on the limb.
 */
function corollaMaterial(flower: string, center: string, inner: string, ribs: number, tubeEnd: number) {
  const m = new MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.38, side: DoubleSide, envMapIntensity: 1.1, sheen: 0.45, sheenRoughness: 0.4, sheenColor: new Color(flower).lerp(new Color("#ffffff"), 0.5), specularIntensity: 0.55 });
  m.onBeforeCompile = shader => {
    thinTissue(shader, 0.65, 0.45);
    Object.assign(shader.uniforms, { centerColor: { value: new Color(center) }, innerColor: { value: new Color(inner) }, ribs: { value: ribs }, tubeEnd: { value: tubeEnd } });
    shader.vertexShader = "attribute float petalT; attribute vec2 petalUv; varying float vPetalT; varying vec2 vPetalUv;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPetalT = petalT; vPetalUv = petalUv;");
    shader.fragmentShader = "uniform vec3 centerColor; uniform vec3 innerColor; uniform float ribs; uniform float tubeEnd; varying float vPetalT; varying vec2 vPetalUv;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float t = vPetalT;
      float vein = pow(0.5 + 0.5 * cos(vPetalUv.x * 18.85), 3.0);
      float midrib = pow(0.5 + 0.5 * cos(vPetalUv.x * 6.2832), 10.0);
      float tube = 1.0 - smoothstep(tubeEnd * 0.7, tubeEnd + 0.2, t);
      float flood = smoothstep(0.1, 0.25 + 0.5 * tubeEnd, t) * (1.0 - 0.45 * ribs * tube * (1.0 - vein));
      float veins = max(vein, midrib) * smoothstep(0.02, 0.14, t);
      if (gl_FrontFacing) {
        diffuseColor.rgb = mix(centerColor, diffuseColor.rgb, max(flood, veins * 0.92)) * (1.0 - 0.1 * ribs * vein * (1.0 - tube));
        diffuseColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 0.2, t));
      } else {
        // The throat takes the inner colour; the thin limb shows the flower colour on both faces, except
        // where its edge rolls back between the points.
        float sinus = 1.0 - pow(0.5 + 0.5 * cos(vPetalUv.x * 6.2832), 2.0);
        float limb = smoothstep(tubeEnd, tubeEnd + 0.2, t) * (1.0 - smoothstep(0.9, 1.0, t) * sinus);
        vec3 inside = mix(centerColor, innerColor, smoothstep(0.15, 0.6, t));
        diffuseColor.rgb = mix(inside, diffuseColor.rgb * 1.15, 0.8 * limb) * (0.95 + 0.05 * vein) * mix(0.55, 1.0, smoothstep(0.3, 0.9, t));
      }`);
  };
  m.customProgramCacheKey = () => "rootsight-corolla-v2";
  return m;
}

export default function Flowers({ profile, state, v }: { profile: PlantProfile; state: PlantState; v: Visual }) {
  const inv = profile.individual?.blooms;
  const flowering = v.botanical.flowering;
  const layout = useMemo(() => bloomLayout(profile, state, v), [profile, state, v]);
  const colors = useMemo(() => ({
    flower: inv?.flowerColor ?? flowering.flowerColor, center: inv?.centerColor ?? flowering.centerColor,
    bud: inv?.budColor ?? flowering.flowerColor, fruit: inv?.fruitColor ?? "#8a3a2a",
  }), [inv, flowering]);
  const shape = inv?.flowerShape;
  const parts = useMemo(() => flowerInstances(layout.organs, flowering, colors, v.seed, state.wilt, shape, inv?.fruitSurface), [layout, flowering, colors, v.seed, state.wilt, shape, inv?.fruitSurface]);
  const resources = useMemo(() => {
    // Soft velvety petals: sheen, gentle roughness, light through thin tissue; faint veins and a paler back.
    const petal = new MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.55, side: DoubleSide, envMapIntensity: 0.75, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new Color(colors.flower).lerp(new Color("#ffffff"), 0.55), specularIntensity: 0.3 });
    petal.onBeforeCompile = shader => {
      thinTissue(shader, 0.65, 0.45); // same thin-tissue light as the leaves: petals belong to the plant, they don't glow apart
      shader.uniforms.centerColor = { value: new Color(colors.center) };
      shader.vertexShader = "attribute float petalT; attribute vec2 petalUv; varying float vPetalT; varying vec2 vPetalUv;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPetalT = petalT; vPetalUv = petalUv;");
      shader.fragmentShader = "uniform vec3 centerColor; varying float vPetalT; varying vec2 vPetalUv;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float across = abs(vPetalUv.x - 0.5) * 2.0;
        float vein = 0.5 + 0.5 * cos((vPetalUv.x - 0.5) * 64.0 / max(0.3, vPetalUv.y + 0.25));
        diffuseColor.rgb *= (0.95 + 0.05 * vein) * (1.0 + 0.07 * smoothstep(0.55, 1.0, across));
        diffuseColor.rgb = mix(centerColor, diffuseColor.rgb, smoothstep(0.06, 0.34, vPetalT));
        // Occlusion where petals crowd into the calyx: the flower sits in its own shade, not on air.
        diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.0, 0.3, vPetalT));
        if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.12) * 1.06;`);
    };
    petal.customProgramCacheKey = () => "rootsight-petal-v2";
    const style = shape && isCorolla(shape, flowering.form) ? corollaStyle(shape, flowering.form) : undefined;
    const models = style ? Array.from({ length: style.layers }, (_, k) => corollaModel(shape!, inv!.flowerDiameterCm, style, k)) : [];
    return {
      petalGeometry: petalGeometry(flowering.form === "spathe" ? Math.max(0.8, flowering.petalWidthToLength) : flowering.petalWidthToLength, flowering.form),
      corollaGeometries: models.map(m => latheGeometry(m.N * 24, 44, m.point, m.N)),
      sheathGeometry: style ? sheathGeometry(style.lobes) : null,
      furledGeometry: style ? furledBudGeometry(style.lobes) : null,
      corolla: style ? corollaMaterial(colors.flower, colors.center, shape!.innerColor ?? `#${new Color(colors.flower).lerp(new Color("#ffffff"), 0.6).getHexString()}`, style.ribs, shape!.tubeFraction) : null,
      petal,
      centre: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
      bud: new MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.5, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new Color("#ffffff") }),
      fruit: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
      // Stalks take the photographed stem colour, deepened a little so thin stalks never read pale.
      stalk: new MeshStandardMaterial({ color: new Color(v.stems.tipColor).lerp(new Color(profile.morphology.stemColor), 0.35).multiplyScalar(0.82), roughness: 0.8, envMapIntensity: 0.5, vertexColors: true, map: stemTexture() }),
      calyx: new MeshStandardMaterial({ color: new Color(v.stems.tipColor).lerp(new Color(profile.morphology.leaf.color), 0.6).multiplyScalar(0.85), roughness: 0.75, envMapIntensity: 0.5 }),
      // A trumpet's calyx is thin, pale tissue: lighter and yellower than the leaves.
      sheath: new MeshStandardMaterial({ color: new Color(profile.morphology.leaf.color).lerp(new Color("#dce6a0"), 0.5), roughness: 0.6, envMapIntensity: 0.6, side: DoubleSide }),
    };
  }, [flowering, colors, v.stems.tipColor, profile.morphology.stemColor, profile.morphology.leaf.color, shape, inv?.flowerDiameterCm]);
  useEffect(() => () => {
    [resources.petalGeometry, ...resources.corollaGeometries, resources.sheathGeometry, resources.furledGeometry].forEach(g => g?.dispose());
    [resources.petal, resources.corolla, resources.centre, resources.bud, resources.fruit, resources.stalk, resources.calyx, resources.sheath].forEach(m => m?.dispose());
  }, [resources]);
  const stalks = useMemo(() => stemGeometry(layout.stalks), [layout]);
  useEffect(() => () => stalks.dispose(), [stalks]);
  if (!layout.organs.length) return null;
  return <group>
    {layout.stalks.length > 0 && <mesh geometry={stalks} material={resources.stalk} castShadow receiveShadow dispose={null} />}
    <Part key={`p${parts.petals.length}`} geometry={resources.petalGeometry} material={resources.petal} items={parts.petals} />
    {resources.corolla && <>
      {resources.corollaGeometries.map((g, k) => parts.corollas[k] && <Part key={`t${k}-${parts.corollas[k].length}`} geometry={g} material={resources.corolla!} items={parts.corollas[k]} />)}
      <Part key={`l${parts.tails.length}`} geometry={TAIL} material={resources.corolla} items={parts.tails} />
      <Part key={`h${parts.sheaths.length}`} geometry={resources.sheathGeometry!} material={resources.sheath} items={parts.sheaths} />
      <Part key={`u${parts.furled.length}`} geometry={resources.furledGeometry!} material={resources.bud} items={parts.furled} />
    </>}
    <Part key={`c${parts.centres.length}`} geometry={SPHERE} material={resources.centre} items={parts.centres} />
    <Part key={`s${parts.spadices.length}`} geometry={SPADIX} material={resources.centre} items={parts.spadices} />
    <Part key={`k${parts.calyces.length}`} geometry={CALYX} material={resources.calyx} items={parts.calyces} />
    <Part key={`b${parts.buds.length}`} geometry={BUD} material={resources.bud} items={parts.buds} />
    <Part key={`f${parts.fruits.length}`} geometry={SPHERE} material={resources.fruit} items={parts.fruits} />
    <Part key={`x${parts.spines.length}`} geometry={SPINE} material={resources.fruit} items={parts.spines} />
  </group>;
}
