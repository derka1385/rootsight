import type { PlantProfile, PlantState } from "@rootsight/shared/schema";

// Stub: a few tapered roots fanning down and out.
// TODO(3d-owner): shape per roots.type (taproot = one thick central root, fibrous = many thin, rhizome = horizontal...),
// recursive branching, growth animation.
export default function Roots({ state }: { state: PlantState; profile: PlantProfile }) {
  const depth = state.rootDepthCm / 100;
  const spread = state.rootSpreadCm / 100;
  const n = 6;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const tilt = Math.atan2((spread / 2) * (0.5 + (i % 3) * 0.25), depth);
        const len = depth / Math.cos(tilt);
        return (
          <group key={i} rotation-y={(i * 2 * Math.PI) / n}>
            <group rotation-z={tilt}>
              <mesh position={[0, -len / 2, 0]}>
                <cylinderGeometry args={[0.012, 0.002, len, 6]} />
                <meshStandardMaterial color="#d9c7a3" />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}
