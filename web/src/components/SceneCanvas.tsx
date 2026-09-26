import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CanvasTexture, Color, NeutralToneMapping, SRGBColorSpace } from "three";
import type { Group } from "three";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, SoftShadows } from "@react-three/drei";
import type { PlantState } from "@rootsight/shared/schema";
import type { RenderProfile as PlantProfile } from "../three/visual";
import Plant from "../three/Plant";
import Roots from "../three/Roots";
import Pot from "../three/Pot";
import CameraFit from "../three/CameraFit";
import { renderSpecOf } from "../three/renderSpec";

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
// A studio shot: soft window key, cool rim for leaf translucency, shadow-only floor on a warm backdrop.
export default function SceneCanvas({ state, profile, cutaway = true, sourceImage, children }: {
  state: PlantState;
  profile: PlantProfile;
  cutaway?: boolean;
  /** Optional photo (data URL or object URL) of this specimen; tints foliage towards the real plant. */
  sourceImage?: string;
  children?: ReactNode;
}) {
  const subject = useRef<Group>(null);
  const leafColor = usePhotoLeafColor(sourceImage, profile.morphology.leaf.color);
  const spec = useMemo(() => renderSpecOf(profile, state, { leafColor }), [profile, state, leafColor]);
  const background = useMemo(backdrop, []);
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
      <hemisphereLight args={["#fffaf0", "#b9a88c", 0.9]} />
      <directionalLight
        position={[-2.2 * reach, 3.6 * reach, 2.4 * reach]}
        intensity={light * 0.75}
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
      {/* Soft studio reflections built in-scene (no HDR download): a window, a bounce card, a skylight. */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3} color="#fff3e2" position={[-3, 2.5, 2.5]} scale={[2.5, 3.5, 1]} target={[0, 0.3, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#f2efe8" position={[3, 1.5, 1]} scale={[3, 2, 1]} target={[0, 0.3, 0]} />
        <Lightformer form="rect" intensity={0.9} color="#dbe7ff" position={[1, 2, -3]} scale={[4, 2, 1]} target={[0, 0.3, 0]} />
        <Lightformer form="circle" intensity={0.8} color="#ffffff" position={[0, 5, 0]} scale={4} />
      </Environment>

      <OrbitControls makeDefault target={[0, 0.3, 0]} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.05} enablePan={false} />
      <CameraFit subject={subject} revision={profile} state={state} bottom={-table} width={Math.max(potR * 2.2, plantWidth)} />

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
        {visual.pot.material !== "none" && <Pot radius={potR} depth={potD} appearance={visual.pot} cutaway={cutaway} />}
        <Plant state={state} profile={profile} spec={spec} />
        {cutaway && visual.pot.material !== "none" && <Roots state={state} profile={profile} bounds={rootBounds} />}
      </group>
    </Canvas>
  );
}

/**
 * Photo-conditioned foliage colour: the median of the leafy pixels in the photo, blended with the
 * profile colour (the photo includes shading, the profile colour is Claude's estimate of albedo).
 */
function usePhotoLeafColor(sourceImage: string | undefined, fallback: string): string {
  const [sampled, setSampled] = useState<{ src: string; color: string | null }>();
  useEffect(() => {
    if (!sourceImage) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, 64, 64);
      const px = g.getImageData(0, 0, 64, 64).data, greens: Color[] = [];
      const hsl = { h: 0, s: 0, l: 0 };
      for (let i = 0; i < px.length; i += 4) {
        const color = new Color().setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, SRGBColorSpace);
        color.getHSL(hsl);
        if (hsl.h > 0.17 && hsl.h < 0.45 && hsl.s > 0.18 && hsl.l > 0.08 && hsl.l < 0.7) greens.push(color);
      }
      const median = (k: "r" | "g" | "b") => greens.map(c => c[k]).sort((a, b) => a - b)[greens.length >> 1];
      if (live) setSampled({ src: sourceImage, color: greens.length > 64 ? `#${new Color(median("r"), median("g"), median("b")).getHexString()}` : null });
    };
    img.src = sourceImage;
    return () => { live = false; };
  }, [sourceImage]);
  if (!sourceImage || sampled?.src !== sourceImage || !sampled.color) return fallback;
  return `#${new Color(fallback).lerp(new Color(sampled.color), 0.6).getHexString()}`;
}
