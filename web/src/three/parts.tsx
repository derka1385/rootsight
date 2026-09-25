import type { ReactNode } from "react";
import type { Material } from "three";
import { SEGMENT, leafGeometry, type LeafForm } from "./procedural";

/** One stem segment: length, base radius and bend (radians) applied at its base. */
export type Seg = { len: number; r: number; bx: number; bz?: number; ry?: number };

/**
 * A bendable, tapered stem built from a chain of segments. `at[i]` is attached at the top of
 * segment i (in that segment's frame), `tip` at the very end. Bending every joint a little
 * (curvature, gravity, wilt) is what makes stems and petioles read as organic.
 */
export function Chain({ segs, material, at, tip }: { segs: Seg[]; material: Material; at?: Record<number, ReactNode>; tip?: ReactNode }) {
  const render = (i: number): ReactNode => {
    if (i === segs.length) return tip ?? null;
    const s = segs[i];
    return (
      <group rotation={[s.bx, s.ry ?? 0, s.bz ?? 0]}>
        <mesh geometry={SEGMENT} material={material} scale={[s.r, s.len, s.r]} />
        <group position-y={s.len}>
          {at?.[i]}
          {render(i + 1)}
        </group>
      </group>
    );
  };
  return <>{render(0)}</>;
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
        <mesh geometry={leafGeometry(form, split)} material={material} scale={size} />
      </group>
    </group>
  );
}
