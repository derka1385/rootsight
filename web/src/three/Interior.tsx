import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, Color, Euler, type Group, MeshBasicMaterial, MeshStandardMaterial, Path, PlaneGeometry, Shape, ShapeGeometry, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { CAMERA_AZ } from "./architecture";
import { plasterTexture, woodTexture } from "./textures";

/*
 * A small, warm cabin corner that exists to ground and light the plant: an oak table against a limewashed
 * wall with a wood-framed window to the right of the plant, and late-afternoon sun coming through it.
 * Laid out in the default camera's frame (x to the right of the picture, z toward the camera) and scaled
 * to the plant, so the composition holds for a 7 cm cactus as for a 1 m monstera.
 */

/** Toward the sun, in the camera frame: behind and to the right of the plant, low in the sky. */
const SUN = new Vector3(0.62, 0.5, -0.6).normalize();
const FRAME = new Euler(0, CAMERA_AZ, 0);
const toWorld = (v: Vector3) => v.clone().applyEuler(FRAME);
const TO_ROOM = new Euler(0, -CAMERA_AZ, 0);

export default function Interior({ floorY, height, halfWidth }: { floorY: number; height: number; halfWidth: number }) {
  const S = Math.max(0.3, height - floorY);
  const onFloor = S > 1.15; // a tall plant stands on the floor instead of a table
  const tableW = Math.max(1.4, halfWidth * 6 + 0.6), tableD = Math.max(0.6, halfWidth * 3 + 0.35), tableZ = -tableD * 0.3;
  const wallZ = tableZ - tableD / 2 - 0.004;
  const groundY = onFloor ? floorY : floorY - 0.76;
  // The window is where sun rays through the plant (pot rim to top) meet the wall, so they light it.
  const back = -wallZ, run = back / -SUN.z;
  const w = Math.max(0.7, S * 2);
  const win = {
    x: Math.max(halfWidth * 1.15 + w / 2, SUN.x * run), w,
    bottom: floorY + Math.max(0.1, Math.min(0.25, SUN.y * run * 0.5)), h: Math.max(0.95, S * 2.6),
  };
  const winY = win.bottom + win.h / 2;

  const res = useMemo(() => {
    const plaster = new MeshStandardMaterial({ color: "#f3e8d8", map: plasterTexture(), roughness: 0.96 });
    // Light falls off away from the window: brighter around it, darker toward the far corner.
    plaster.onBeforeCompile = shader => {
      shader.uniforms.windowXY = { value: [win.x, win.bottom + win.h * 0.45] };
      shader.vertexShader = "varying vec2 vWallXY;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvWallXY = position.xy;");
      shader.fragmentShader = "uniform vec2 windowXY; varying vec2 vWallXY;\n" + shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\nfloat d = distance(vWallXY, windowXY);\ndiffuseColor.rgb *= 0.74 + 0.36 * exp(-d * d / 0.9);");
    };
    plaster.customProgramCacheKey = () => "rootsight-wall-v1";
    const oak = new MeshStandardMaterial({ color: "#e9c7a0", map: woodTexture(), roughness: 0.45 });
    const frameWood = new MeshStandardMaterial({ color: "#f3dcbb", map: woodTexture(), roughness: 0.55 });
    // Outside: the warm glow of the low sun, bright enough to read as the light source.
    const outside = new MeshBasicMaterial({ color: new Color("#ffe2b5").multiplyScalar(1.25) });
    const wall = new Shape().moveTo(-6, groundY).lineTo(6, groundY).lineTo(6, groundY + 6).lineTo(-6, groundY + 6).closePath();
    wall.holes.push(new Path().moveTo(win.x - win.w / 2, win.bottom).lineTo(win.x + win.w / 2, win.bottom)
      .lineTo(win.x + win.w / 2, win.bottom + win.h).lineTo(win.x - win.w / 2, win.bottom + win.h).closePath());
    return { plaster, oak, frameWood, outside, wall: new ShapeGeometry(wall), table: new BoxGeometry(tableW, 0.04, tableD), floor: new PlaneGeometry(8, 8), sky: new PlaneGeometry(10, 8) };
  }, [win.x, win.w, win.bottom, win.h, tableW, tableD, groundY]);
  useEffect(() => () => { Object.values(res).forEach(r => r.dispose()); }, [res]);

  // Chunky honey-wood frame: sill, head, jambs, a mullion and a transom.
  const bar = 0.045, depth = 0.08;
  const frame: [x: number, y: number, w: number, h: number, d: number][] = [
    [win.x, win.bottom - bar * 0.3, win.w + bar * 2.5, bar * 0.8, depth * 1.6], [win.x, win.bottom + win.h, win.w + bar * 2, bar, depth],
    [win.x - win.w / 2, winY, bar, win.h, depth], [win.x + win.w / 2, winY, bar, win.h, depth],
    [win.x, winY, bar * 0.7, win.h, depth * 0.8], [win.x, win.bottom + win.h * 0.66, win.w, bar * 0.7, depth * 0.8],
  ];
  const aim = new Vector3(0, height * 0.4, 0);
  // Orbiting behind the plant takes the camera through the wall: hide the wall (and its window) then, so
  // the room never blocks inspection. The table stays; it is below the plant.
  const wallGroup = useRef<Group>(null);
  const local = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const behind = local.copy(camera.position).applyEuler(TO_ROOM).z < wallZ + 0.05;
    if (wallGroup.current && wallGroup.current.visible === behind) wallGroup.current.visible = !behind;
  });
  // A tight sun frustum around the plant: sub-millimetre texels, so petals and stalks shadow each other.
  const reach = Math.max(0.5, S * 1.6);

  return <>
    <color attach="background" args={["#d9c3a5"]} />
    {/* Late-afternoon sun through the window; the wall around it gives the frame's soft shadow. */}
    <directionalLight position={toWorld(SUN).multiplyScalar(6).add(aim)} intensity={4.2} color="#ffc486" castShadow
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.002}
      shadow-camera-left={-reach} shadow-camera-right={reach} shadow-camera-top={reach} shadow-camera-bottom={-reach} shadow-camera-near={1} shadow-camera-far={14} />
    {/* Warm bounce from the room behind the camera: the plant's front never goes flat or black. */}
    <hemisphereLight args={["#f8e9d6", "#7a5638", 0.6]} />
    <Environment resolution={128} environmentIntensity={0.7}>
      <Lightformer form="rect" intensity={4.5} color="#ffd29c" position={toWorld(new Vector3(win.x, winY, wallZ - 0.2)).toArray()} scale={[win.w * 2, win.h * 2, 1]} target={aim.toArray()} />
      <Lightformer form="rect" intensity={1.7} color="#fff1e0" position={toWorld(new Vector3(-1.5, 1.2, 3)).toArray()} scale={[5, 3, 1]} target={aim.toArray()} />
      <Lightformer form="rect" intensity={0.6} color="#f0d9bc" position={toWorld(new Vector3(-3, 1, 0)).toArray()} scale={[4, 3, 1]} target={aim.toArray()} />
      <Lightformer form="circle" intensity={0.5} color="#f7eee2" position={[0, 4, 0]} scale={3} />
    </Environment>

    <group rotation={FRAME}>
      <group ref={wallGroup}>
        <mesh geometry={res.wall} material={res.plaster} position={[0, 0, wallZ]} receiveShadow castShadow />
        {frame.map(([x, y, w, h, d], i) => (
          <mesh key={i} material={res.frameWood} position={[x, y, wallZ + d / 2 - 0.02]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
          </mesh>
        ))}
        <mesh geometry={res.sky} material={res.outside} position={[win.x, winY, wallZ - 1.2]} />
      </group>
      {onFloor
        ? <mesh geometry={res.floor} material={res.oak} rotation-x={-Math.PI / 2} position={[0, floorY - 0.001, 0]} receiveShadow />
        : <mesh geometry={res.table} material={res.oak} position={[0, floorY - 0.02, tableZ]} receiveShadow castShadow />}
    </group>
  </>;
}
