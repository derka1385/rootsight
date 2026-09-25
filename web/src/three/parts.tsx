import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Euler, InstancedMesh, Matrix4, type Material } from "three";
import { SEGMENT, leafGeometry, type LeafForm } from "./procedural";

/** One stem segment: length, base radius and bend (radians) applied at its base. */
export type Seg = { len: number; r: number; bx: number; bz?: number; ry?: number };

/**
 * A bendable, tapered stem built from a chain of segments. `at[i]` is attached at the top of
 * segment i (in that segment's frame), `tip` at the very end. Bending every joint a little
 * (curvature, gravity, wilt) is what makes stems and petioles read as organic.
 */
export function Chain({ segs, material, at, tip }: { segs: Seg[]; material: Material; at?: Record<number, ReactNode>; tip?: ReactNode }) {
  const mesh = useRef<InstancedMesh>(null);
  const frames = useMemo(() => {
    const current = new Matrix4();
    return segs.map(s => {
      current.multiply(new Matrix4().makeRotationFromEuler(new Euler(s.bx, s.ry ?? 0, s.bz ?? 0)));
      const segment = current.clone().multiply(new Matrix4().makeScale(s.r, s.len, s.r));
      current.multiply(new Matrix4().makeTranslation(0, s.len, 0));
      return { segment, end: current.clone() };
    });
  }, [segs]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    frames.forEach((frame, i) => mesh.current!.setMatrixAt(i, frame.segment));
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingBox(); mesh.current.computeBoundingSphere();
  }, [frames]);
  useEffect(() => { const instance = mesh.current; return () => instance?.dispose(); }, [segs.length]);
  return <>
    {frames.length > 0 && <instancedMesh ref={mesh} args={[SEGMENT, material, frames.length]} dispose={null} castShadow />}
    {frames.map((frame, i) => <group key={i} matrix={frame.end} matrixAutoUpdate={false}>{at?.[i]}{i === frames.length - 1 && tip}</group>)}
    {frames.length === 0 && tip}
  </>;

}

/** Evenly split `length` into n segments tapering from r0, with a constant bend per joint. */
export function taper(n: number, length: number, r0: number, bendFirst: number, bendRest: number, jitter: (i: number) => number = () => 0): Seg[] {
  return Array.from({ length: n }, (_, i) => ({
    len: length / n,
    r: r0 * Math.pow(0.82, i),
    bx: (i === 0 ? bendFirst : bendRest) + jitter(i),
  }));
}

/**
 * A leaf blade attached at the end of a stem frame (+y = stem direction).
 * `pitch` tips the blade away from the stem axis (towards local +z), `roll` twists it.
 */
export function Leaf({ form, split, size, pitch, roll, material }: { form: LeafForm; split?: boolean; size: number; pitch: number; roll: number; material: Material }) {
  if (size <= 0.0005) return null;
  return (
    <group rotation={[-Math.PI / 2 + pitch, 0, 0]}>
      <group rotation-z={roll}>
        <mesh geometry={leafGeometry(form, split)} material={material} scale={size} castShadow receiveShadow />
      </group>
    </group>
  );
}
