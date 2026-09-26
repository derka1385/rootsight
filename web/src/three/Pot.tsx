import { useEffect, useMemo } from "react";
import { DoubleSide, LatheGeometry, MeshStandardMaterial, PlaneGeometry, Vector2 } from "three";
import type { Visual } from "./visual";
import { soilTexture, terracottaTexture } from "./textures";
import { useSurfaceMaps } from "./assets";

/** Angle (lathe convention: x = r·sin φ, z = r·cos φ) the cut-away faces: towards the default camera. */
export const CUT_CENTER = Math.atan2(1.6, 2.4);
const CUT = Math.PI / 2;

/**
 * Terracotta pot with a quarter cut away, so the soil cross-section and the roots show.
 * Soil surface at y = 0 (where the plant starts); pot rim just above it.
 */
export default function Pot({ radius, depth, appearance, cutaway = true }: { radius: number; depth: number; appearance: Visual["pot"]; cutaway?: boolean }) {
  const surface = useSurfaceMaps(appearance.material === "none" ? "plastic" : appearance.material);
  const soilMaps = useSurfaceMaps("soil");
  const { wall, rim, fill, top, cut, mats } = useMemo(() => {
    const R = radius, D = depth, t = R * 0.06;
    const phiStart = cutaway ? CUT_CENTER + CUT / 2 : 0, phiLength = Math.PI * 2 - (cutaway ? CUT : 0);
    // Outer profile from the base up to the lip, then back down the inside.
    const outer = [
      new Vector2(R * 0.72, -D), new Vector2(R * 0.78, -D * 0.98), new Vector2(R * 0.95, -D * 0.1),
      new Vector2(R * 0.97, D * 0.015),
    ];
    const inner = [new Vector2(R * 0.97 - t, D * 0.015), new Vector2(R * 0.93 - t, -D * 0.2), new Vector2(R * 0.74 - t, -D * 0.96)];
    const wall = new LatheGeometry([...outer, ...inner], 64, phiStart, phiLength);
    // Rolled lip: a fat band just above the soil line.
    const lip = [
      new Vector2(R * 0.95, -0.08 * D), new Vector2(R * 1.06, -0.05 * D), new Vector2(R * 1.04, D * 0.035),
      new Vector2(R * 1.01, D * 0.075), new Vector2(R * 0.95 - t * 0.5, D * 0.07), new Vector2(R * 0.95 - t, D * 0.015),
    ];
    const rim = new LatheGeometry(lip, 64, phiStart, phiLength);
    // Soil body (same wedge), plus the two flat faces of the cut.
    const soilR = R * 0.93 - t;
    const fill = new LatheGeometry([new Vector2(0.0001, -D * 0.97), new Vector2(R * 0.73 - t, -D * 0.97), new Vector2(soilR, -0.002)], 48, phiStart, phiLength);
    const top = new LatheGeometry([new Vector2(soilR, 0), new Vector2(0.0001, 0.006)], 48, phiStart, phiLength);
    const face = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
    const soil = soilMaps?.albedo ?? soilTexture();
    const mats = {
      clay: new MeshStandardMaterial({
        color: appearance.color, map: surface?.albedo ?? (appearance.material === "terracotta" ? terracottaTexture() : null),
        normalMap: surface?.normal ?? null, roughnessMap: surface?.roughness ?? null,
        roughness: surface?.roughness ? 1 : appearance.material === "ceramic" ? 0.24 : appearance.material === "plastic" ? 0.48 : 0.92,
      }),
      clayInside: new MeshStandardMaterial({ color: appearance.color, roughness: 0.95, side: DoubleSide }),
      soil: new MeshStandardMaterial({ color: "#ffffff", map: soil, normalMap: soilMaps?.normal ?? null, roughness: 1, side: DoubleSide }),
      // Cross-section: lifted so the roots in front of it read clearly.
      section: new MeshStandardMaterial({ color: "#ffffff", map: soil, emissive: "#ffffff", emissiveMap: soil, emissiveIntensity: 0.55, roughness: 1, side: DoubleSide }),
    };
    return { wall, rim, fill, top, cut: { face, soilR, D }, mats };
  }, [radius, depth, appearance.color, appearance.material, cutaway, surface, soilMaps]);
  useEffect(() => () => {
    [wall, rim, fill, top, cut.face].forEach((g) => g.dispose());
    Object.values(mats).forEach((m) => m.dispose());
  }, [wall, rim, fill, top, cut, mats]);

  return (
    <group>
      <mesh geometry={wall} material={mats.clay} castShadow receiveShadow />
      <mesh geometry={wall} material={mats.clayInside} scale={[0.999, 1, 0.999]} />
      <mesh geometry={rim} material={mats.clay} castShadow receiveShadow />
      <mesh geometry={fill} material={mats.soil} receiveShadow />
      {appearance.soilVisible && <mesh geometry={top} material={mats.soil} receiveShadow />}
      {/* Cross-section faces at both edges of the cut. */}
      {cutaway && [CUT_CENTER + CUT / 2, CUT_CENTER - CUT / 2].map((phi) => (
        <mesh key={phi} geometry={cut.face} material={mats.section} rotation-y={phi - Math.PI / 2} position-y={-cut.D * 0.97} scale={[cut.soilR, cut.D * 0.97, 1]} receiveShadow />
      ))}
    </group>
  );
}
