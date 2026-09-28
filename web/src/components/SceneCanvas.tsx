import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace, type Group, type Material, type Mesh, type Object3D } from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ContactShadows, OrbitControls, SoftShadows } from "@react-three/drei";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "../three/visual";
import Plant from "../three/Plant";
import Roots from "../three/Roots";
import Pot from "../three/Pot";
import CameraFit from "../three/CameraFit";
import { visualOf, potDimensions } from "../three/visual";
import { architectureOf } from "../three/architecture";
import Interior from "../three/Interior";

// One metre per world unit; the photographed soil line is y=0.
// The main view shows the plant as photographed: an intact pot. Roots (a cut-away pot) are opt-in.
export default function SceneCanvas({ state, profile, cutaway = false, children }: { state: PlantState; profile: PlantProfile; cutaway?: boolean; children?: ReactNode }) {
  const subject = useRef<Group>(null);
  const visual = visualOf(profile);
  const { radius: potR, depth: potD } = potDimensions(profile);
  const trailing = architectureOf(profile, visual) === "vine";
  const plantWidth = state.heightCm / 100 * visual.silhouette.widthToHeight;
  const rootScale: [number, number, number] = [Math.min(1, potR * 1.5 / Math.max(0.01, state.rootSpreadCm / 100)), Math.min(1, potD * 0.9 / Math.max(0.01, state.rootDepthCm / 100)), Math.min(1, potR * 1.5 / Math.max(0.01, state.rootSpreadCm / 100))];
  const table = trailing ? -Math.max(potD, state.heightCm / 100 * 1.2) : -potD;

  return (
    // preserveDrawingBuffer lets the UI screenshot the canvas for /api/refine
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [1.6, 0.85, 2.4], fov: 40 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.95, outputColorSpace: SRGBColorSpace }}
    >
      {children}
      {/* Soft penumbrae that widen with distance, like real window light. */}
      <SoftShadows size={16} samples={10} focus={0.6} />
      <Interior floorY={table} height={state.heightCm / 100} halfWidth={Math.max(potR, plantWidth / 2)} />
      <AmbientOcclusion radius={Math.max(0.03, state.heightCm / 100 * 0.12)} />

      {/* Free orbit all the way around the plant (the room gets out of the way), from table level to overhead. */}
      <OrbitControls makeDefault target={[0, 0.3, 0]} minPolarAngle={0.12} maxPolarAngle={Math.PI / 2 - 0.06} enablePan={false} enableDamping dampingFactor={0.12} rotateSpeed={0.8} zoomToCursor />
      <CameraFit subject={subject} revision={profile} state={state} bottom={-table} width={Math.max(potR * 2.2, plantWidth)} />

      {trailing && <mesh position-y={(table - potD) / 2} receiveShadow castShadow>
        <cylinderGeometry args={[potR * 0.7, potR * 0.85, -table - potD, 24]} />
        <meshStandardMaterial color="#d8c4a8" roughness={0.85} />
      </mesh>}
      <ContactShadows key={`${state.heightCm}:${state.wilt}:${JSON.stringify(visual)}`} frames={1} position={[0, table + 0.002, 0]} scale={potR * 5} blur={2.6} opacity={0.5} far={potD + 0.4} resolution={256} color="#3b2615" />

      <group ref={subject}>
        {visual.pot.material !== "none" && <Pot radius={potR} depth={potD} appearance={visual.pot} cutaway={cutaway} />}
        <Plant state={state} profile={profile} />
        {cutaway && visual.pot.material !== "none" && <group scale={rootScale}><Roots state={state} profile={profile} /></group>}
      </group>
    </Canvas>
  );
}

/**
 * Ground-truth ambient occlusion (three's GTAOPass): leaves darken where they crowd, the soil under the
 * canopy and the pot on the table sit in their own contact shade. Half-resolution AO keeps it cheap.
 */
function AmbientOcclusion({ radius }: { radius: number }) {
  const gl = useThree(s => s.gl), scene = useThree(s => s.scene), camera = useThree(s => s.camera), size = useThree(s => s.size);
  const { composer, ao } = useMemo(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, 512, 512);
    ao.blendIntensity = 0.85;
    // Transparent contact-shadow planes would read as solid ground in the AO pre-pass: hide them there.
    // ponytail: patches a private GTAOPass hook; if three renames it, AO simply includes those planes again.
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
  useEffect(() => { ao.updateGtaoMaterial({ radius, distanceExponent: 1.4, thickness: radius * 2, scale: 1, samples: 16 }); ao.updatePdMaterial({ radius: 6 }); }, [ao, radius]);
  // Priority 1 takes over rendering from R3F; frameloop="demand" still only renders when invalidated.
  useFrame(() => composer.render(), 1);
  return null;
}
