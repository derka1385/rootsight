import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import Plant, { baseRadius } from "../three/Plant";
import Roots from "../three/Roots";
import Pot from "../three/Pot";
import CameraFit from "../three/CameraFit";
import { woodTexture } from "../three/textures";

// Window light per care.light: [intensity, colour]. Sun is warmer and harder.
const WINDOW = {
  low: [1.3, "#ffe9cf"],
  medium: [2, "#ffe3c0"],
  "bright-indirect": [2.6, "#ffe0b5"],
  "full-sun": [3.4, "#ffd49a"],
} as const;

// Scene units: 1 = 1 m. Soil surface at y = 0, plant above, roots and pot below.
// A plant on a wooden table by a window: warm key light with soft shadows, a cut-away terracotta pot.
export default function SceneCanvas({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  // Rounded to the centimetre so the pot is rebuilt only when it really changes size.
  const potR = Math.ceil(Math.max(0.1, profile.roots.maxSpreadCm / 200, (state.rootSpreadCm / 200) * 1.1, baseRadius(profile, state) * 1.25) * 100) / 100;
  const potD = Math.min(0.45, Math.max(0.12, (profile.roots.maxDepthCm / 100) * 1.05));
  const [light, tint] = WINDOW[profile.care.light];
  const table = -potD;

  return (
    // preserveDrawingBuffer lets the UI screenshot the canvas for /api/refine
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [1.6, 1.1, 2.4], fov: 40 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <color attach="background" args={["#e9e1d3"]} />
      <fog attach="fog" args={["#e9e1d3", 4, 11]} />
      <hemisphereLight args={["#fff6e8", "#a07a58", 0.7]} />
      <directionalLight
        position={[-2.2, 4, 2.6]}
        intensity={light}
        color={tint}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-1.6}
        shadow-camera-right={1.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-1}
        shadow-camera-far={12}
      />
      <directionalLight position={[2.5, 1.5, -2]} intensity={0.35} color="#cfe0ff" />
      {/* Soft studio reflections built in-scene (no HDR download). */}
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={2} color="#fff1dc" position={[-3, 3, 2]} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#dfe8ff" position={[3, 2, -2]} scale={[3, 2, 1]} />
        <Lightformer form="circle" intensity={0.6} color="#ffffff" position={[0, 5, 0]} scale={3} />
      </Environment>

      <OrbitControls makeDefault target={[0, 0.3, 0]} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.05} enablePan={false} />
      <CameraFit state={state} bottom={potD} width={Math.max(potR * 2.2, baseRadius(profile, state) * 2)} />

      {/* Oak table the pot stands on */}
      <mesh rotation-x={-Math.PI / 2} position-y={table - 0.001} receiveShadow>
        <circleGeometry args={[6, 64]} />
        <meshStandardMaterial map={woodTexture()} color="#d9c6ad" roughness={0.75} />
      </mesh>
      <ContactShadows position={[0, table + 0.001, 0]} scale={potR * 5} blur={2.4} opacity={0.55} far={potD + 0.4} resolution={256} color="#3b2414" />

      <Pot radius={potR} depth={potD} />
      <Plant state={state} profile={profile} />
      <Roots state={state} profile={profile} />
    </Canvas>
  );
}
