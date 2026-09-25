import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import Plant from "../three/Plant";
import Roots from "../three/Roots";

const BG = "#0f1411";

// Scene units: 1 = 1 m. Ground at y = 0, roots below.
// TODO(3d-owner): window light following care.light; proper soil cut-away (clipping planes).
export default function SceneCanvas({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  const h = Math.max(0.3, state.heightCm / 100);
  return (
    // preserveDrawingBuffer lets the UI screenshot the canvas for /api/refine
    <Canvas shadows camera={{ position: [0.5, 0.95, 1.5], fov: 40 }} gl={{ preserveDrawingBuffer: true }} dpr={[1, 2]}>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 3 * h, 7 * h]} />

      {/* soft studio: warm key with soft shadows, cool rim to outline the leaves, sky/ground bounce */}
      <hemisphereLight args={["#e6efdc", "#4a5a3a", 0.9]} />
      <directionalLight
        position={[1.6, 3, 1.8]}
        intensity={2.1}
        color="#fff2dd"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-1.2 * h}
        shadow-camera-right={1.2 * h}
        shadow-camera-top={1.6 * h}
        shadow-camera-bottom={-0.6 * h}
      />
      <directionalLight position={[-1.5, 1.6, -2]} intensity={1.6} color="#cfe2ff" />
      <Environment resolution={128} environmentIntensity={0.3}>
        <Lightformer form="rect" intensity={2} position={[2, 3, 2]} scale={[3, 2, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#bcd4ff" position={[-3, 1, -2]} scale={[3, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.5} position={[0, 4, 0]} scale={2} target={[0, 0, 0]} />
      </Environment>

      <CameraRig height={h} />

      {/* soil top: back half solid, front half see-through so the roots stay visible */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[0.32, 48, 0, Math.PI]} />
        <meshStandardMaterial color="#3a2a1d" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[0.32, 48, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#3a2a1d" roughness={1} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {/* pot rim */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.325, 0.012, 12, 96]} />
        <meshStandardMaterial color="#c9b49a" roughness={0.75} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} scale={1.4 * h + 0.6} blur={2.4} opacity={0.55} far={0.8} color="#000" />
      {/* soil volume: a faint glass-like column so the roots read as "inside the pot" */}
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[0.32, 0.28, 0.5, 64, 1, true]} />
        <meshStandardMaterial color="#8a6a4a" transparent opacity={0.14} depthWrite={false} side={2} />
      </mesh>

      <Plant state={state} profile={profile} />
      <Roots state={state} profile={profile} />
    </Canvas>
  );
}

// Keeps the whole plant framed as it grows, without fighting the user's orbit afterwards.
function CameraRig({ height }: { height: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const last = useRef(0);
  const settling = useRef(0);
  const dir = new Vector3();
  useFrame(({ camera }, dt) => {
    const c = controls.current;
    if (!c) return;
    if (height !== last.current) {
      last.current = height;
      settling.current = 1.2; // seconds of easing after a size change
    }
    if (settling.current <= 0) return;
    settling.current -= dt;
    const k = 1 - Math.exp(-dt * 5);
    const targetY = height * 0.36;
    const dist = height * 3.2;
    c.target.y += (targetY - c.target.y) * k;
    dir.subVectors(camera.position, c.target);
    dir.setLength(dir.length() + (dist - dir.length()) * k);
    camera.position.copy(c.target).add(dir);
    c.update();
  });
  return <OrbitControls ref={controls} target={[0, 0.26, 0]} enablePan={false} minDistance={0.4} maxDistance={8} maxPolarAngle={Math.PI * 0.62} />;
}
