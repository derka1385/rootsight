import { useMemo } from "react";
import { Color } from "three";
import type { PlantProfile, PlantState } from "@rootsight/shared/schema";
import Monstera from "./Monstera";

const GOLDEN_ANGLE = 2.39996;

// Stub: one stem + leaves spiralling up it.
// TODO(3d-owner): L-system branching (branchingAngleDeg, branchingDepth), leaf geometry per leaf.shape,
// shape per growthForm (rosette, vine, succulent...), animated wilt.
export default function Plant({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  // ponytail: only fenestrated leaves get the art-directed plant; other shapes keep the stub until they get their own.
  if (profile.morphology.leaf.shape === "fenestrated") return <Monstera state={state} profile={profile} />;
  return <Stub state={state} profile={profile} />;
}

function Stub({ state, profile }: { state: PlantState; profile: PlantProfile }) {
  const { stemColor, leaf } = profile.morphology;
  const height = state.heightCm / 100;
  const leafLen = leaf.lengthCm / 100;
  const leafColor = useMemo(
    () => new Color(leaf.color).lerp(new Color("#8a6d3b"), state.wilt * 0.7),
    [leaf.color, state.wilt],
  );
  const count = Math.min(state.leafCount, 40);

  return (
    <group rotation-z={state.wilt * 0.25}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[height * 0.012, height * 0.02, height, 8]} />
        <meshStandardMaterial color={stemColor} />
      </mesh>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[0, height * (0.3 + (0.7 * i) / Math.max(1, count - 1)), 0]} rotation-y={i * GOLDEN_ANGLE}>
          {/* droops more as the plant wilts */}
          <group rotation-x={0.3 + state.wilt * 1.1}>
            <mesh position={[0, 0, leafLen / 2]} scale={[leafLen * 0.35, 0.004, leafLen / 2]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={leafColor} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
