import { useRef, type ReactNode } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace, type Group } from "three";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "../three/visual";
import Plant from "../three/Plant";
import Roots from "../three/Roots";
import Pot from "../three/Pot";
import CameraFit from "../three/CameraFit";
import { visualOf, potDimensions } from "../three/visual";
import { architectureOf } from "../three/architecture";
import PlantLighting from "../three/PlantLighting";

// One metre per world unit; the photographed soil line is y=0.
export default function SceneCanvas({ state, profile, cutaway = true, children }: { state: PlantState; profile: PlantProfile; cutaway?: boolean; children?: ReactNode }) {
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
      shadows="percentage"
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [1.6, 1.1, 2.4], fov: 40 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
    >
      {children}
      <PlantLighting />

      <OrbitControls makeDefault target={[0, 0.3, 0]} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.05} enablePan={false} />
      <CameraFit subject={subject} revision={profile} state={state} bottom={-table} width={Math.max(potR * 2.2, plantWidth)} />

      {/* Matte ground stays subordinate to the plant. */}
      <mesh rotation-x={-Math.PI / 2} position-y={table - 0.001} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial color="#e0e4dc" roughness={0.96} />
      </mesh>
      {trailing && <mesh position-y={(table - potD) / 2} receiveShadow castShadow>
        <cylinderGeometry args={[potR * 0.7, potR * 0.85, -table - potD, 24]} />
        <meshStandardMaterial color="#c5ccbf" roughness={0.9} />
      </mesh>}
      <ContactShadows key={`${state.heightCm}:${state.wilt}:${JSON.stringify(visual)}`} frames={1} position={[0, table + 0.001, 0]} scale={potR * 5} blur={2.4} opacity={0.32} far={potD + 0.4} resolution={256} color="#53624f" />

      <group ref={subject}>
        {visual.pot.material !== "none" && <Pot radius={potR} depth={potD} appearance={visual.pot} cutaway={cutaway} />}
        <Plant state={state} profile={profile} />
        {cutaway && visual.pot.material !== "none" && <group scale={rootScale}><Roots state={state} profile={profile} /></group>}
      </group>
    </Canvas>
  );
}
