import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { PlantState } from "@rootsight/shared/schema";

type Controls = { target: Vector3; update: () => void };

/**
 * Keeps a 15 cm basil and a 2 m monstera both framed: when the plant's size changes, glide the orbit
 * target and distance to fit plant + pot, then hand the camera back to the user.
 * Works with frameloop="demand": it asks for frames only while gliding.
 */
export default function CameraFit({ state, bottom = 0, width = 0 }: { state: PlantState; bottom?: number; width?: number }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const goal = useRef({ y: 0.3, dist: 2.9, until: 0 });

  const h = state.heightCm / 100;
  const d = Math.max(state.rootDepthCm / 100, bottom);
  const spread = state.rootSpreadCm / 100;
  useEffect(() => {
    const span = Math.max(h + d, spread * 0.8, width * 1.25, 0.25);
    // Leaves spread about as wide as the plant is tall: narrow canvases need to back off further.
    const dist = Math.max(0.55, (span * 1.45) / 0.73) / Math.min(1, aspect * 1.1);
    goal.current = { y: (h - d) / 2, dist, until: performance.now() + 900 };
    invalidate();
  }, [h, d, spread, width, aspect, invalidate]);

  const dir = useRef(new Vector3());
  useFrame(() => {
    if (!controls || performance.now() > goal.current.until) return;
    const t = controls.target;
    t.y += (goal.current.y - t.y) * 0.12;
    dir.current.copy(camera.position).sub(t);
    const len = dir.current.length();
    dir.current.setLength(len + (goal.current.dist - len) * 0.12);
    camera.position.copy(t).add(dir.current);
    controls.update();
    invalidate();
  });
  return null;
}
