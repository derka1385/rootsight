import { useEffect, useLayoutEffect, useRef } from "react";
import type { BufferGeometry, InstancedMesh, Material, Matrix4 } from "three";

/** All stems share one draw call, all blades at most four, irrespective of visible leaf count. */
export function Instances({ geometry, material, matrices, capacity }: { geometry: BufferGeometry; material: Material; matrices: Matrix4[]; capacity: number }) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => { const mesh = ref.current; return () => mesh?.dispose(); }, []);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geometry, material, capacity]} castShadow receiveShadow dispose={null} />;
}
