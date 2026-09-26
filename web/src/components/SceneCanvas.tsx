import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { CanvasTexture, NeutralToneMapping, SRGBColorSpace, type Material, type Mesh, type Object3D } from "three";
import type { Group } from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ContactShadows, Environment, Lightformer, OrbitControls, SoftShadows } from "@react-three/drei";
import type { GrowthConditions, PlantScan } from "@rootsight/shared/schema";
import Plant from "../three/Plant";
import Roots from "../three/Roots";
import Pot from "../three/Pot";
import CameraFit from "../three/CameraFit";
import { renderPlanOf, type RenderMode } from "../three/renderPlan";
import { useEnvironmentFile } from "../three/assets";

// Window intensity follows care.light; neutral fill preserves sampled foliage colors.
const WINDOW = {
  low: 1.5,
  medium: 2.1,
  "bright-indirect": 2.6,
  "full-sun": 3.3,
} as const;

/** Seamless studio backdrop: a screen-space gradient, so the plant reads like a product shot. */
function backdrop() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#f4f1ea"); grad.addColorStop(0.62, "#ebe5da"); grad.addColorStop(1, "#ddd4c6");
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Scene units: 1 = 1 m. Soil surface at y = 0, plant above, roots and pot below.
// A studio product shot: soft window key, cool rim for leaf translucency, shadow-only floor on a warm
// backdrop, the pot intact. Roots (a cut-away pot) are an opt-in x-ray, never the hero view.
export default function SceneCanvas({ scan, mode = "scanned", months = 0, conditions, roots = false, padBottom = 0, children }: {
  scan: PlantScan;
  /** "scanned": today's plant rebuilt from the photo. "future": the same plant grown `months` ahead. */
  mode?: RenderMode;
  months?: number;
  conditions?: GrowthConditions;
  roots?: boolean;
  /** Fraction of the canvas covered by overlaid UI at the bottom (the framing keeps the pot above it). */
  padBottom?: number;
  children?: ReactNode;
}) {
  const subject = useRef<Group>(null);
  const spec = useMemo(() => renderPlanOf(scan, mode, months, conditions), [scan, mode, months, conditions]);
  const { state, profile } = spec;
  const cutaway = roots;
  const background = useMemo(backdrop, []);
  const hdri = useEnvironmentFile();
  useEffect(() => () => background.dispose(), [background]);
  const visual = spec.visual;
  const { radius: potR, depth: potD } = spec.pot;
  const trailing = spec.archetype === "vine";
  const plantWidth = spec.heightM * visual.silhouette.widthToHeight;
  const light = WINDOW[profile.care.light];
  const rootBounds = useMemo(() => ({ radius: potR * 0.86, depth: potD * 0.95 }), [potR, potD]);
  const table = trailing ? -Math.max(potD, spec.heightM * 1.2) : -potD;
  const reach = Math.max(1, spec.heightM + potD);

  return (
    // preserveDrawingBuffer lets the UI screenshot the canvas for /api/refine
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [1.5, 1.3, 2.3], fov: 40, near: 0.02, far: 60 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: NeutralToneMapping, toneMappingExposure: 1.05 }}
    >
      {children}
      {/* Penumbra that widens with distance: the single biggest "not a video game" win. */}
      <SoftShadows size={22} samples={12} focus={0.7} />
      <primitive attach="background" object={background} />
      <hemisphereLight args={["#fffaf0", "#b9a88c", hdri ? 0.35 : 0.9]} />
      <directionalLight
        position={[-2.2 * reach, 3.6 * reach, 2.4 * reach]}
        intensity={light * (hdri ? 0.6 : 0.75)}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
        shadow-camera-left={-1.3 * reach}
        shadow-camera-right={1.3 * reach}
        shadow-camera-top={1.6 * reach}
        shadow-camera-bottom={-0.9 * reach}
        shadow-camera-near={0.1}
        shadow-camera-far={12 * reach}
      />
      {/* Cool rim from behind: backlit blades glow through the translucency term. */}
      <directionalLight position={[1.8, 2.2, -2.6]} intensity={0.9} color="#e3eeff" />
      {/* A real photo-studio HDRI (CC0) lights and reflects when present; otherwise in-scene softboxes. */}
      {hdri ? <Suspense fallback={null}><Environment files={hdri} environmentIntensity={0.75} /></Suspense> : <Environment resolution={128}>
        <Lightformer form="rect" intensity={3} color="#fff3e2" position={[-3, 2.5, 2.5]} scale={[2.5, 3.5, 1]} target={[0, 0.3, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#f2efe8" position={[3, 1.5, 1]} scale={[3, 2, 1]} target={[0, 0.3, 0]} />
        <Lightformer form="rect" intensity={0.9} color="#dbe7ff" position={[1, 2, -3]} scale={[4, 2, 1]} target={[0, 0.3, 0]} />
        <Lightformer form="circle" intensity={0.8} color="#ffffff" position={[0, 5, 0]} scale={4} />
      </Environment>}
      <AmbientOcclusion radius={Math.max(0.03, spec.heightM * 0.15)} />

      <OrbitControls makeDefault target={[0, 0.3, 0]} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.05} enablePan={false} />
      <CameraFit subject={subject} revision={`${mode}:${roots}`} padBottom={padBottom} state={state} bottom={-table} width={Math.max(potR * 2.2, plantWidth)} />

      {/* Shadow-only floor: the backdrop stays seamless, the plant still sits on something. */}
      <mesh rotation-x={-Math.PI / 2} position-y={table - 0.001} receiveShadow>
        <circleGeometry args={[8 * reach, 64]} />
        <shadowMaterial color="#4a3a28" opacity={0.2} />
      </mesh>
      {trailing && <mesh position-y={(table - potD) / 2} receiveShadow castShadow>
        <cylinderGeometry args={[potR * 0.7, potR * 0.85, -table - potD, 32]} />
        <meshStandardMaterial color="#d9d2c5" roughness={0.9} />
      </mesh>}
      <ContactShadows key={`${state.heightCm.toFixed(1)}:${state.wilt.toFixed(2)}`} frames={1} position={[0, table + 0.001, 0]} scale={potR * 5} blur={2.2} opacity={0.6} far={potD + 0.4} resolution={256} color="#2e2014" />

      <group ref={subject}>
        {spec.pot.material !== "none" && <Pot radius={potR} depth={potD} appearance={visual.pot} shape={spec.pot.shape} cutaway={cutaway} />}
        <Plant plan={spec} />
        {cutaway && spec.pot.material !== "none" && <Roots state={state} profile={profile} bounds={rootBounds} />}
      </group>
    </Canvas>
  );
}

/**
 * Ground-truth-style ambient occlusion (three's GTAOPass): leaves darken where they crowd, the
 * crown and the soil darken under the canopy, the pot sits in its own contact shadow. This is most
 * of the difference between "rendered" and "photographed".
 */
function AmbientOcclusion({ radius }: { radius: number }) {
  const gl = useThree(s => s.gl), scene = useThree(s => s.scene), camera = useThree(s => s.camera), size = useThree(s => s.size);
  const { composer, ao } = useMemo(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, 512, 512);
    ao.blendIntensity = 1;
    // Shadow-catcher floors are transparent: in the AO depth/normal pre-pass they would read as solid
    // ground and punch pale halos under low leaves, so hide them there like GTAOPass hides lines.
    // ponytail: patches a private GTAOPass hook; if three renames it, AO simply includes the floor again.
    const pass = ao as unknown as { _overrideVisibility: () => void; _visibilityCache: Object3D[] };
    const hideLines = pass._overrideVisibility.bind(ao);
    pass._overrideVisibility = () => {
      hideLines();
      scene.traverse(o => {
        const material = (o as Mesh).material as Material | undefined;
        if ((o as Mesh).isMesh && o.visible && material && !Array.isArray(material) && material.transparent) { o.visible = false; pass._visibilityCache.push(o); }
      });
    };
    composer.addPass(ao);
    composer.addPass(new OutputPass());
    return { composer, ao };
  }, [gl, scene, camera]);
  useEffect(() => () => composer.dispose(), [composer]);
  useEffect(() => { composer.setPixelRatio(gl.getPixelRatio()); composer.setSize(size.width, size.height); }, [composer, gl, size]);
  useEffect(() => { ao.updateGtaoMaterial({ radius, distanceExponent: 1.4, thickness: radius * 2, scale: 1.1, samples: 16 }); ao.updatePdMaterial({ radius: 6 }); }, [ao, radius]);
  // Priority 1 takes over rendering from R3F; frameloop="demand" still only renders when invalidated.
  useFrame(() => composer.render(), 1);
  return null;
}
