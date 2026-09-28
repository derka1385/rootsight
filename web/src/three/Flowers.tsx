import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import type { PlantState } from "@rootsight/shared/schema";
import type { SpeciesFlowering } from "@rootsight/shared/schema";
import { stemGeometry } from "./StemGeometry";
import { seededRandom } from "./procedural";
import { bloomLayout, type BloomOrgan } from "./bloomLayout";
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

/** Unit petal: base at the origin, tip at z = 1, front face +y, cupped toward the front. */
function petalGeometry(widthToLength: number, pointed: boolean): BufferGeometry {
  const ROWS = 8, COLS = 6, pos: number[] = [], t01: number[] = [], index: number[] = [];
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS;
    // Narrow claw at the base, widest past the middle, rounded (or pointed) tip.
    const w = widthToLength / 2 * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.6)), pointed ? 1.1 : 0.55);
    for (let c = 0; c <= COLS; c++) {
      const s = c / COLS * 2 - 1;
      pos.push(s * w, 0.35 * s * s * w + 0.08 * t * t, t);
      t01.push(t);
    }
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = r * (COLS + 1) + c, b = a + COLS + 1;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("petalT", new Float32BufferAttribute(t01, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Closed bud: a teardrop along +z, radius 1 at its widest. */
function budGeometry(): BufferGeometry {
  const g = new SphereGeometry(1, 12, 10).rotateX(Math.PI / 2);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), taper = 1 - 0.55 * Math.max(0, z);
    p.setXYZ(i, p.getX(i) * taper, p.getY(i) * taper, z * 1.35);
  }
  g.computeVertexNormals();
  return g;
}

const SPHERE = new SphereGeometry(1, 12, 8);
const SPADIX = new CylinderGeometry(0.75, 1, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const BUD = budGeometry();
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

export function flowerInstances(organs: BloomOrgan[], flowering: SpeciesFlowering, colors: { flower: string; center: string; bud: string; fruit: string }, seed: string, wilt: number) {
  const petals: Instance[] = [], centres: Instance[] = [], buds: Instance[] = [], fruits: Instance[] = [], spadices: Instance[] = [];
  const form = FORMS[flowering.form];
  const petalCount = flowering.form === "spathe" ? 1 : Math.max(3, flowering.form === "daisy" ? Math.max(13, flowering.petals) : flowering.petals || 5);
  const flower = new Color(colors.flower), center = new Color(colors.center);
  for (const o of organs) {
    const r = seededRandom(`${seed}:bloom-organ:${o.id}`);
    if (o.kind === "bud") {
      buds.push({ matrix: new Matrix4().compose(o.position, basis(o.facing, UP), new Vector3(o.size * 0.3, o.size * 0.3, o.size * 0.5)), color: new Color(colors.bud).offsetHSL(0, 0, (r() - 0.5) * 0.06) });
      continue;
    }
    if (o.kind === "fruit") {
      fruits.push({ matrix: new Matrix4().compose(o.position, new Quaternion(), new Vector3().setScalar(o.size / 2)), color: new Color(colors.fruit).offsetHSL(0, 0, (r() - 0.5) * 0.05) });
      continue;
    }
    // Petals fan around the face axis; drought closes and droops them a little.
    const F = o.facing.clone().normalize();
    const u = new Vector3().crossVectors(F, Math.abs(F.y) > 0.9 ? new Vector3(1, 0, 0) : UP).normalize();
    const w = new Vector3().crossVectors(F, u);
    const tint = flower.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06);
    const rings = flowering.form === "double" ? 2 : 1;
    for (let ring = 0; ring < rings; ring++) {
      const phase = r() * Math.PI * 2 + ring * Math.PI / petalCount;
      for (let i = 0; i < petalCount; i++) {
        const phi = phase + (i / petalCount) * Math.PI * 2 + (r() - 0.5) * 0.25;
        const plane = u.clone().multiplyScalar(Math.cos(phi)).addScaledVector(w, Math.sin(phi));
        // Drought closes cup-like flowers a little; swept-back petals just stay as they are (the head nods instead).
        const open = (form.open - ring * 30 + (r() - 0.5) * 16) * (form.open <= 90 ? 1 - wilt * 0.25 : 1) * Math.PI / 180;
        const axis = F.clone().multiplyScalar(Math.cos(open)).addScaledVector(plane, Math.sin(open)).normalize();
        // Orchids: the lower petal is the broad lip.
        const lip = flowering.form === "orchid" && i === 0 ? 1.35 : 1;
        const length = o.size * form.length * (ring ? 0.72 : 1) * lip * (0.92 + r() * 0.16);
        const base = o.position.clone().addScaledVector(plane, o.size * 0.05);
        petals.push({ matrix: new Matrix4().compose(base, basis(axis, F), new Vector3().setScalar(length)), color: tint });
      }
    }
    if (flowering.form === "spathe") spadices.push({ matrix: new Matrix4().compose(o.position, basis(F.clone().lerp(UP, 0.4).normalize(), UP), new Vector3(o.size * 0.05, o.size * 0.05, o.size * 0.5)), color: center });
    else centres.push({ matrix: new Matrix4().compose(o.position.clone().addScaledVector(F, o.size * 0.03), new Quaternion(), new Vector3().setScalar(o.size * (flowering.form === "daisy" ? 0.16 : 0.08))), color: center });
  }
  return { petals, centres, buds, fruits, spadices };
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

export default function Flowers({ profile, state, v }: { profile: PlantProfile; state: PlantState; v: Visual }) {
  const inv = profile.individual?.blooms;
  const flowering = v.botanical.flowering;
  const layout = useMemo(() => bloomLayout(profile, state, v), [profile, state, v]);
  const colors = useMemo(() => ({
    flower: inv?.flowerColor ?? flowering.flowerColor, center: inv?.centerColor ?? flowering.centerColor,
    bud: inv?.budColor ?? flowering.flowerColor, fruit: inv?.fruitColor ?? "#8a3a2a",
  }), [inv, flowering]);
  const parts = useMemo(() => flowerInstances(layout.organs, flowering, colors, v.seed, state.wilt), [layout, flowering, colors, v.seed, state.wilt]);
  const resources = useMemo(() => {
    const petal = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, side: DoubleSide, emissive: new Color(colors.flower), emissiveIntensity: 0.06 });
    petal.onBeforeCompile = shader => {
      shader.uniforms.centerColor = { value: new Color(colors.center) };
      shader.vertexShader = "attribute float petalT; varying float vPetalT;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPetalT = petalT;");
      shader.fragmentShader = "uniform vec3 centerColor; varying float vPetalT;\n" + shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(centerColor, diffuseColor.rgb, smoothstep(0.06, 0.34, vPetalT));");
    };
    petal.customProgramCacheKey = () => "rootsight-petal-v1";
    return {
      petalGeometry: petalGeometry(flowering.form === "spathe" ? Math.max(0.8, flowering.petalWidthToLength) : flowering.petalWidthToLength, flowering.form === "star" || flowering.form === "spathe"),
      petal,
      centre: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
      bud: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
      fruit: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.32 }),
      stalk: new MeshStandardMaterial({ color: v.stems.tipColor, roughness: 0.6 }),
    };
  }, [flowering, colors, v.stems.tipColor]);
  useEffect(() => () => { resources.petalGeometry.dispose(); [resources.petal, resources.centre, resources.bud, resources.fruit, resources.stalk].forEach(m => m.dispose()); }, [resources]);
  const stalks = useMemo(() => stemGeometry(layout.stalks), [layout]);
  useEffect(() => () => stalks.dispose(), [stalks]);
  if (!layout.organs.length) return null;
  return <group>
    {layout.stalks.length > 0 && <mesh geometry={stalks} material={resources.stalk} castShadow receiveShadow dispose={null} />}
    <Part key={`p${parts.petals.length}`} geometry={resources.petalGeometry} material={resources.petal} items={parts.petals} />
    <Part key={`c${parts.centres.length}`} geometry={SPHERE} material={resources.centre} items={parts.centres} />
    <Part key={`s${parts.spadices.length}`} geometry={SPADIX} material={resources.centre} items={parts.spadices} />
    <Part key={`b${parts.buds.length}`} geometry={BUD} material={resources.bud} items={parts.buds} />
    <Part key={`f${parts.fruits.length}`} geometry={SPHERE} material={resources.fruit} items={parts.fruits} />
  </group>;
}
