import { BufferGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry } from "three";
import type { Visual } from "./visual";

/** Unit blade: base at z=0, tip at z=1, adaxial (top) face toward +y. */
export function leafBlade(v: Visual["leaves"], maturity = 1): BufferGeometry {
  const shape = new Shape();
  const ratio = v.widthToLength;
  const outline: [number, number][] = [];
  const fen = v.fenestration * maturity;
  const widthAt = (t: number) => {
    const exponent = v.tip === "rounded" ? 0.48 : 0.85;
    const shift = v.base === "heart" ? 0.08 + 0.92 * t : v.base === "rounded" ? 0.025 + 0.975 * t : t;
    let w = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(shift, 0.78))), exponent);
    if (v.edge === "serrated") w *= 1 - 0.055 * (0.5 + 0.5 * Math.cos(t * Math.PI * 40));
    if (v.edge === "lobed") w *= 0.73 + 0.27 * Math.cos(t * Math.PI * 10);
    // Narrow, curved sinuses, with rounded fingers between them, never horizontal ladder cuts.
    if (fen > 0) for (let i = 0; i < 4; i++) {
      const center = 0.28 + i * 0.14;
      w *= 1 - fen * 0.72 * Math.exp(-(((t - center) / 0.035) ** 2));
    }
    return w * ratio / 2;
  };
  for (const side of [-1, 1]) for (let j = 0; j <= 96; j++) {
    const t = side === -1 ? j / 96 : 1 - j / 96;
    const x = side * widthAt(t);
    const z = t - (v.base === "heart" ? 0.13 * Math.pow(1 - t, 7) : 0);
    outline.push([x, z]);
  }
  // A basal notch separates the heart lobes and keeps the petiole on the midrib.
  if (v.base === "heart") outline.push([0, 0.04]);
  outline.forEach(([x, z], i) => i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z));
  shape.closePath();
  if (fen > 0.12) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    // Keep enclosed holes between the margin sinuses, even at maximum fenestration.
    const t = 0.35 + i * 0.14;
    const hole = new Path();
    hole.absellipse(side * ratio * (0.16 - i * 0.015), t, ratio * 0.06 * fen, 0.032 * fen, 0, Math.PI * 2, true, side * 0.35);
    shape.holes.push(hole);
  }
  const flat = new ShapeGeometry(shape, 10);
  const pos = flat.getAttribute("position");
  const vertices: number[][] = Array.from({ length: pos.count }, (_, i) => [pos.getX(i), pos.getY(i)]);
  let indices = Array.from(flat.index!.array);
  // Subdivide with shared edge vertices so curl has smooth normals around true cut-out holes.
  for (let pass = 0; pass < 1; pass++) {
    const midpoints = new Map<string, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const hit = midpoints.get(key);
      if (hit !== undefined) return hit;
      const i = vertices.length;
      vertices.push([(vertices[a][0] + vertices[b][0]) / 2, (vertices[a][1] + vertices[b][1]) / 2]);
      midpoints.set(key, i); return i;
    };
    const next: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3), ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    indices = next;
  }
  const p: number[] = [], uv: number[] = [];
  for (const [x, z] of vertices) {
    const t = Math.max(0, z);
    const y = v.curl * (x * x / ratio * 0.8 - t * t * 0.3) + v.twist * x * t * 0.55 + 0.065 * Math.sin(Math.PI * t) * Math.cos(x / ratio * Math.PI * 2);
    p.push(x, y, z); uv.push(x / ratio + 0.5, z);
  }
  // ShapeGeometry's +z winding becomes -y after moving its y into z; reverse for +y.
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingSphere(); flat.dispose();
  return g;
}
