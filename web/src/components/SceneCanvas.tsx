import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import Plant from "../three/Plant";
import Roots from "../three/Roots";

// Scene units: 1 = 1 m. Ground at y = 0, roots below.
// TODO(3d-owner): warm, cozy environment (pot, table, window light following care.light, soft shadows)
// and a proper soil cut-away (clipping planes) so the roots stay visible.
export default function SceneCanvas({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  return (
    // preserveDrawingBuffer lets the UI screenshot the canvas for /api/refine
    <Canvas camera={{ position: [1.6, 1.1, 2.4], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
      <color attach="background" args={["#0f1411"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} />
      <OrbitControls target={[0, 0.3, 0]} />

      {/* Ground: back half only, so the front is "cut away" */}
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1, 48, 0, Math.PI]} />
        <meshStandardMaterial color="#4a3726" side={2} />
      </mesh>
      {/* Soil volume: translucent so the roots stay visible */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[2, 0.8, 2]} />
        <meshStandardMaterial color="#6b4a2f" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      <Plant state={state} profile={profile} />
      <Roots state={state} profile={profile} />
    </Canvas>
  );
}
