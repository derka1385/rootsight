import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BufferGeometry, Color, ConeGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import type { Material } from "three";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "./visual";
import { seededRandom, SEGMENT } from "./procedural";
import { leafBlade } from "./leafBlade";
import { leafSurface } from "./leafSurface";
import { architectureOf, plantLayout } from "./architecture";
import { visualOf, type Visual } from "./visual";

/** Keep the existing thumbnail API while the renderer uses the richer architecture internally. */
export function archetypeOf(p: PlantProfile): "rosette" | "branching" | "cactus" {
  const kind = architectureOf(p, visualOf(p));
  return kind === "cactus" ? "cactus" : ["aroid", "grass", "succulent"].includes(kind) ? "rosette" : "branching";
}

/** All stems share one draw call, all blades at most four, irrespective of visible leaf count. */
function Instances({ geometry, material, matrices, capacity }: { geometry: BufferGeometry; material: Material; matrices: Matrix4[]; capacity: number }) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => { const mesh = ref.current; return () => mesh?.dispose(); }, []);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geometry, material, capacity]} castShadow receiveShadow dispose={null} />;
}

export default function Plant({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  const v = useMemo(() => visualOf(profile), [profile]);
  const kind = architectureOf(profile, v);
  const lean = v.silhouette.leanDeg * Math.PI / 180;
  const direction = v.silhouette.leanDirectionDeg * Math.PI / 180;
  return <group rotation={[Math.sin(direction) * lean, 0, -Math.cos(direction) * lean]}>
    {kind === "cactus" ? <Cactus profile={profile} state={state} v={v} /> : <Foliage profile={profile} state={state} v={v} />}
  </group>;
}

function Foliage({ profile, state, v }: { profile: PlantProfile; state: PlantState; v: Visual }) {
  const resources = useMemo(() => {
    const blades = [0, 1, 2, 3].map(i => leafBlade(v.leaves, 0.25 + i * 0.25));
    const materials = [0, 1, 2, 3].map(i => leafSurface(profile, v, i));
    const stem = new MeshStandardMaterial({ color: profile.morphology.stemColor, roughness: 0.8 });
    stem.onBeforeCompile = shader => {
      shader.uniforms.tipColor = { value: new Color(v.stems.tipColor) };
      shader.vertexShader = 'varying float stemAge;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nstemAge = uv.y;');
      shader.fragmentShader = 'uniform vec3 tipColor; varying float stemAge;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, tipColor, stemAge * 0.45);');
    };
    return { blades, materials, stem };
  }, [profile, v]);
  useEffect(() => () => {
    resources.blades.forEach(g => g.dispose());
    resources.materials.forEach(m => { m.map?.dispose(); m.dispose(); });
    resources.stem.dispose();
  }, [resources]);
  useLayoutEffect(() => {
    resources.materials.forEach(m => m.color.set('#ffffff').lerp(new Color('#b29b6b'), state.wilt * 0.36));
  }, [resources, state.wilt]);
  const layout = useMemo(() => plantLayout(profile, state, v), [profile, state, v]);
  return <group>
    <Instances geometry={SEGMENT} material={resources.stem} matrices={layout.stems} capacity={1024} />
    {resources.blades.map((g, i) => <Instances key={i} geometry={g} material={resources.materials[i]} matrices={layout.leaves[i]} capacity={160} />)}
  </group>;
}
type CactusKind = "barrel" | "column";

/** Radius profile along the body height t in [0, 1]. */
function cactusProfile(t: number, kind: CactusKind): number {
  if (kind === "barrel") return t < 0.4 ? 0.82 + 0.18 * Math.sin((Math.PI / 2) * (t / 0.4)) : Math.sqrt(Math.max(0, 1 - ((t - 0.4) / 0.6) ** 2));
  return t < 0.8 ? 1 + 0.05 * Math.sin((Math.PI * t) / 0.8) : Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2));
}



/** Ribbed body, radius 1, height 1, closed rounded top; built once per rib count and kind. */
function cactusBody(ribs: number, kind: CactusKind): BufferGeometry {
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
  return g;
}

const SPINE = new ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0);
const AREOLE = new SphereGeometry(1, 6, 4);

function Cactus({ profile, state, v }: { profile: PlantProfile; state: PlantState; v: Visual }) {
  const kind = v.cactus.form === "column" ? "column" : "barrel";
  const resources = useMemo(() => ({
    body: cactusBody(v.cactus.ribs, kind),
    skin: new MeshStandardMaterial({ color: profile.morphology.stemColor, roughness: 0.54 }),
    spine: new MeshStandardMaterial({ color: v.cactus.spineColor, roughness: 0.8 }),
    areole: new MeshStandardMaterial({ color: '#d8c9a0', roughness: 1 }),
  }), [v.cactus.ribs, v.cactus.spineColor, kind, profile.morphology.stemColor]);
  useEffect(() => () => { resources.body.dispose(); resources.skin.dispose(); resources.spine.dispose(); resources.areole.dispose(); }, [resources]);
  useLayoutEffect(() => { resources.skin.color.set(profile.morphology.stemColor).lerp(new Color('#9a874c'), state.wilt * 0.25 + v.condition.yellowing * 0.5); }, [resources, profile.morphology.stemColor, state.wilt, v.condition.yellowing]);
  const layout = useMemo(() => {
    const bodies: Matrix4[] = [], spines: Matrix4[] = [], areoles: Matrix4[] = [];
    const H = state.heightCm / 100, R = H * v.silhouette.widthToHeight / 2 * (1 - state.wilt * 0.12);
    const rand = seededRandom(v.seed + ':cactus');
    const rows = Math.round(4 + v.cactus.spineDensity * 9);
    for (let bodyIndex = 0; bodyIndex <= v.cactus.offsets; bodyIndex++) {
      const scale = bodyIndex ? 0.32 + rand() * 0.14 : 1;
      const az = bodyIndex * 2.39996;
      const pos = bodyIndex ? new Vector3(Math.sin(az) * R * 0.85, v.cactus.form === 'pads' ? H * 0.55 : 0, Math.cos(az) * R * 0.85) : new Vector3();
      const h = H * scale, r = R * scale;
      const flatten = v.cactus.form === 'pads' ? 0.28 : 1;
      bodies.push(new Matrix4().compose(pos, new Quaternion(), new Vector3(r, h, r * flatten)));
      for (let rib = 0; rib < v.cactus.ribs; rib++) for (let row = 0; row < rows; row++) {
        if (v.cactus.spineDensity === 0) continue;
        const theta = rib / v.cactus.ribs * Math.PI * 2;
        const t = 0.08 + row / rows * 0.88 + rib % 2 * 0.017;
        const prof = cactusProfile(t, kind), rr = r * prof * (kind === 'barrel' ? 1.09 : 1.13);
        const origin = new Vector3(Math.cos(theta) * rr, t * h, Math.sin(theta) * rr * flatten).add(pos);
        const dir = new Vector3(Math.cos(theta) * prof, 0.25 + (1 - prof), Math.sin(theta) * prof).normalize();
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
        const dot = Math.min(h * 0.018, 0.0025);
        areoles.push(new Matrix4().compose(origin, q, new Vector3(dot, dot * 0.45, dot)));
        for (let j = 0; j < 5; j++) {
          const fan = j / 5 * Math.PI * 2;
          const spineDir = new Vector3(Math.cos(fan) * 0.6, 0.65, Math.sin(fan) * 0.6).applyQuaternion(q).normalize();
          const length = profile.morphology.leaf.lengthCm / 100 * (0.55 + rand() * 0.2) * scale;
          const sq = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), spineDir);
          spines.push(new Matrix4().compose(origin, sq, new Vector3(length * 0.038, length, length * 0.038)));
        }
      }
    }
    return { bodies, spines, areoles };
  }, [state.heightCm, state.wilt, v, kind, profile.morphology.leaf.lengthCm]);
  return <group>
    <Instances geometry={resources.body} material={resources.skin} matrices={layout.bodies} capacity={7} />
    <Instances geometry={SPINE} material={resources.spine} matrices={layout.spines} capacity={14560} />
    <Instances geometry={AREOLE} material={resources.areole} matrices={layout.areoles} capacity={2912} />
  </group>;
}

export function baseRadius(profile: PlantProfile, state: PlantState): number {
  const v = visualOf(profile);
  return architectureOf(profile, v) === "cactus" ? state.heightCm / 200 * v.silhouette.widthToHeight : 0;
}
