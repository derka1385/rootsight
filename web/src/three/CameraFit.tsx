import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, Group, InstancedMesh, Matrix4, Mesh, Vector3 } from "three";
import type { PlantState } from "@rootsight/shared/schema";

type Controls = { target: Vector3; update: () => void };

/** Fit the visible plant and container, independent of inferred hidden root dimensions. */
export default function CameraFit({ state, bottom = 0, width = 0, subject, revision }: { state: PlantState; bottom?: number; width?: number; subject?: RefObject<Group | null>; revision?: unknown }) {
  const camera = useThree(s => s.camera);
  const invalidate = useThree(s => s.invalidate);
  const aspect = useThree(s => s.size.width / Math.max(1, s.size.height));
  const controls = useThree(s => s.controls) as unknown as Controls | null;
  const goal = useRef({ y: 0.3, dist: 2.9, moving: false });
  // Re-measure for a moment after each change: the plant glides to its new shape over ~1 s.
  const measureUntil = useRef(0);
  const center = useRef(new Vector3());
  const initial = useRef(true);
  const direction = useRef(new Vector3());
  const height = state.heightCm / 100;
  useEffect(() => {
    const span = height + bottom;
    const dist = Math.max(span, width / Math.max(0.2, aspect)) * 1.35 / (2 * Math.tan(20 * Math.PI / 180));
    goal.current = { y: (height - bottom) / 2, dist: Math.max(0.15, dist), moving: true };
    measureUntil.current = performance.now() + 1200;
    invalidate();
  }, [height, state.wilt, bottom, width, aspect, invalidate, revision]);
  useFrame((_, delta) => {
    if (!controls || !goal.current.moving) return;
    const measuring = performance.now() < measureUntil.current;
    if (measuring && subject?.current) {
      subject.current.updateWorldMatrix(true, true);
      // Visible meshes only: hidden helpers (an unused moss pole) must not pull the framing.
      const box = new Box3();
      subject.current.traverseVisible(object => { if (object instanceof Mesh) box.union(new Box3().setFromObject(object)); });
      if (!box.isEmpty()) {
        box.getCenter(center.current);
        const inverse = camera.quaternion.clone().invert();
        let distance = 0;
        // Project per-instance bounds instead of a single oversized world-axis box.
        subject.current.traverse(object => {
          if (!(object instanceof Mesh) || !object.visible) return;
          if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
          const bounds = object.geometry.boundingBox;
          if (!bounds) return;
          const count = object instanceof InstancedMesh ? object.count : 1;
          for (let i = 0; i < count; i++) {
            const transform = new Matrix4();
            if (object instanceof InstancedMesh) object.getMatrixAt(i, transform);
            transform.premultiply(object.matrixWorld);
            for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
              const point = new Vector3(x, y, z).applyMatrix4(transform).sub(center.current).applyQuaternion(inverse);
              distance = Math.max(distance, point.z + Math.max(Math.abs(point.y), Math.abs(point.x) / aspect * 0.7) / Math.tan(20 * Math.PI / 180));
            }
          }
        });
        goal.current.dist = Math.max(0.15, distance * 1.02);
        goal.current.y = center.current.y;
      }
    }
    const target = controls.target, goalNow = goal.current;
    const factor = initial.current ? 1 : 1 - Math.exp(-10 * Math.min(delta, 0.1));
    direction.current.copy(camera.position).sub(target);
    const distance = direction.current.length();
    target.x += (center.current.x - target.x) * factor;
    target.z += (center.current.z - target.z) * factor;
    target.y += (goalNow.y - target.y) * factor;
    direction.current.setLength(distance + (goalNow.dist - distance) * factor);
    camera.position.copy(target).add(direction.current);
    controls.update();
    initial.current = false;
    goalNow.moving = measuring || Math.abs(goalNow.y - target.y) + Math.abs(goalNow.dist - direction.current.length()) > 0.0005;
    if (goalNow.moving) invalidate();
  });
  return null;
}
