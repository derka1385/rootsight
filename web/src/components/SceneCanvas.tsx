import { useRef, type ReactNode } from "react";
import type { Group } from "three";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "../three/visual";
import Plant from "../three/Plant";
import Roots from "../three/Roots";
import Pot from "../three/Pot";
import CameraFit from "../three/CameraFit";
import { visualOf, potDimensions } from "../three/visual";
import { architectureOf } from "../three/architecture";
import { woodTexture } from "../three/textures";

// Window intensity follows care.light; neutral fill preserves sampled foliage colors.
const WINDOW = {
  low: 1.3,
  medium: 2,
  "bright-indirect": 2.6,
  "full-sun": 3.4,
} as const;

// Scene units: 1 = 1 m. Soil surface at y = 0, plant above, roots and pot below.
// A plant on a wooden table by a window: warm key light with soft shadows, a cut-away terracotta pot.
export default function SceneCanvas({ state, profile, cutaway = true, children }: { state: PlantState; profile: PlantProfile; cutaway?: boolean; children?: ReactNode }) {
  const subject = useRef<Group>(null);
  const visual = visualOf(profile);
  const { radius: potR, depth: potD } = potDimensions(profile);
  const trailing = architectureOf(profile, visual) === "vine";
  const plantWidth = state.heightCm / 100 * visual.silhouette.widthToHeight;
  const light = WINDOW[profile.care.light];
  const rootScale: [number, number, number] = [Math.min(1, potR * 1.5 / Math.max(0.01, state.rootSpreadCm / 100)), Math.min(1, potD * 0.9 / Math.max(0.01, state.rootDepthCm / 100)), Math.min(1, potR * 1.5 / Math.max(0.01, state.rootSpreadCm / 100))];
  const table = trailing ? -Math.max(potD, state.heightCm / 100 * 1.2) : -potD;

  return (
    // preserveDrawingBuffer lets the UI screenshot the canvas for /api/refine
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [1.6, 1.1, 2.4], fov: 40 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      {children}
      <color attach="background" args={["#e9e1d3"]} />
      <fog attach="fog" args={["#e9e1d3", 4, 11]} />
      <hemisphereLight args={["#fff6e8", "#9c8464", 1.05]} />
      <directionalLight
        position={[-2.2, 4, 2.6]}
        intensity={light * 0.6}
        color="#fff0d9"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-1.6}
        shadow-camera-right={1.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-1}
        shadow-camera-far={12}
      />
      <directionalLight position={[2.5, 1.5, -2]} intensity={0.5} color="#cfe0ff" />
      {/* Soft studio reflections built in-scene (no HDR download). */}
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={2.6} color="#fff1dc" position={[-3, 3, 2]} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#dfe8ff" position={[3, 2, -2]} scale={[3, 2, 1]} />
        <Lightformer form="circle" intensity={0.6} color="#ffffff" position={[0, 5, 0]} scale={3} />
      </Environment>

      <OrbitControls makeDefault target={[0, 0.3, 0]} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.05} enablePan={false} />
      <CameraFit subject={subject} revision={profile} state={state} bottom={-table} width={Math.max(potR * 2.2, plantWidth)} />

      {/* Oak table the pot stands on */}
      <mesh rotation-x={-Math.PI / 2} position-y={table - 0.001} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial map={woodTexture()} color="#d9c6ad" roughness={0.75} />
      </mesh>
      {trailing && <mesh position-y={(table - potD) / 2} receiveShadow castShadow>
        <cylinderGeometry args={[potR * 0.7, potR * 0.85, -table - potD, 24]} />
        <meshStandardMaterial color="#776452" roughness={0.9} />
      </mesh>}
      <ContactShadows key={`${state.heightCm}:${state.wilt}:${JSON.stringify(visual)}`} frames={1} position={[0, table + 0.001, 0]} scale={potR * 5} blur={2.4} opacity={0.55} far={potD + 0.4} resolution={256} color="#3b2414" />

      <group ref={subject}>
        {visual.pot.material !== "none" && <Pot radius={potR} depth={potD} appearance={visual.pot} cutaway={cutaway} />}
        <Plant state={state} profile={profile} />
        {cutaway && visual.pot.material !== "none" && <group scale={rootScale}><Roots state={state} profile={profile} /></group>}
      </group>
    </Canvas>
  );
}
