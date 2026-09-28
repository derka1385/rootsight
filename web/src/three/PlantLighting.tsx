import { Environment, Lightformer } from "@react-three/drei";

/** Neutral botanical studio: procedural softboxes, no downloaded HDRI or postprocessing. */
export default function PlantLighting() {
  return <>
    <color attach="background" args={["#e9ece5"]} />
    <fog attach="fog" args={["#e9ece5", 3, 9]} />
    <hemisphereLight args={["#f8faf2", "#a6b09e", 1.1]} />
    <directionalLight position={[-2.8, 4.5, 3.5]} intensity={2.1} color="#fff9ec" castShadow
      shadow-mapSize={[1024, 1024]} shadow-bias={-0.0002} shadow-normalBias={0.002}
      shadow-camera-left={-2.5} shadow-camera-right={2.5} shadow-camera-top={3.5} shadow-camera-bottom={-1.5} shadow-camera-far={14} />
    <directionalLight position={[3, 2, -2]} intensity={0.7} color="#edf4ee" />
    <Environment resolution={64}>
      <Lightformer form="rect" intensity={1.7} color="#fffdf5" position={[-3, 4, 3]} scale={[4, 3, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ecf3eb" position={[3, 2, -2]} scale={[3, 3, 1]} />
      <Lightformer form="circle" intensity={0.8} color="#ffffff" position={[0, 5, 0]} scale={4} />
    </Environment>
  </>;
}
