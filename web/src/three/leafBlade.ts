import { BufferGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry } from "three";
import type { Visual } from "./visual";

/** Unit blade: base at z=0, tip at z=1, adaxial (top) face toward +y. */
export function leafBlade(v: Visual["leaves"], maturity = 1): BufferGeometry {
  const shape = new Shape();
  const ratio = v.widthToLength;
  const outline: [number, number][] = [];
  const fen = v.fenestration * maturity;
  const holes: { x: number; z: number; rx: number; rz: number }[] = [];
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
    const x = side * widthAt(t) * (1 + side * v.asymmetry * 0.12 * Math.sin(t * Math.PI));
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
    const ellipse = { x: side * ratio * (0.16 - i * 0.015), z: t, rx: ratio * 0.06 * fen, rz: 0.032 * fen };
    holes.push(ellipse);
    hole.absellipse(ellipse.x, ellipse.z, ellipse.rx, ellipse.rz, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const flat = new ShapeGeometry(shape, 10);
  const pos = flat.getAttribute("position");
  const vertices: number[][] = Array.from({ length: pos.count }, (_, i) => [pos.getX(i), pos.getY(i)]);
  const juvenile = vertices.map(([x, z]) => {
    const hole = holes.find(h => Math.abs(((x - h.x) / h.rx) ** 2 + ((z - h.z) / h.rz) ** 2 - 1) < 0.02);
    if (hole) return [hole.x + (x - hole.x) * 0.015, hole.z + (z - hole.z) * 0.015];
    // Juvenile outlines retain the same vertex identities while their sinuses close.
    let factor = 1;
    for (let i = 0; i < 4; i++) factor *= 1 - fen * 0.72 * Math.exp(-(((z - (0.28 + i * 0.14)) / 0.035) ** 2));
    return [x / Math.max(0.2, factor) * 0.82, z];
  });
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
      juvenile.push([(juvenile[a][0] + juvenile[b][0]) / 2, (juvenile[a][1] + juvenile[b][1]) / 2]);
      midpoints.set(key, i); return i;
    };
    const next: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3), ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    indices = next;
  }
  const positions: number[] = [], juvenilePositions: number[] = [], uv: number[] = [], side: number[] = [];
  const surface = (x: number, z: number, young: boolean) => {
    const t = Math.max(0, z), half = ratio / 2, a = Math.min(1, Math.abs(x) / half), fold = v.fold * (young ? 1.4 : 1);
    const along = Math.sin(Math.PI * Math.min(1, t * 1.15));
    // Longitudinal: the blade arches and its tip droops a little.
    const arch = -(0.08 + 0.22 * Math.max(0, v.curl)) * t * t;
    // Transverse: margins lift into a shallow gutter (or roll under for negative curl), a V along the midrib.
    const cup = (0.06 + 0.3 * Math.abs(v.curl)) * Math.sign(v.curl || 1) * a * a * half * along;
    const vee = fold * a * half * Math.sin(Math.PI * t);
    // Midrib: a narrow groove on the upper face; soft quilting between the lateral veins.
    const midrib = -0.011 * Math.exp(-a * 14) * along;
    const quilt = 0.004 * Math.sin(t * Math.PI * 11 + a * 2.2) * a * (1 - a);
    return arch + cup + vee + midrib + quilt + v.twist * x * t * 0.55;
  };
  for (const face of [1, -1]) for (let i = 0; i < vertices.length; i++) {
    const [x, z] = vertices[i], [jx, jz] = juvenile[i];
    const thick = v.thickness * (0.2 + 0.8 * Math.sin(Math.PI * Math.max(0, z))) / 2;
    positions.push(x, surface(x, z, false) + face * thick, z);
    juvenilePositions.push(jx, surface(jx, jz, true) + face * thick * 0.8, jz);
    uv.push(x / ratio + 0.5, z); side.push(face);
  }
  // Shape's +z winding maps to -y; reverse the upper surface and then close its boundary.
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const n = vertices.length, closed = [...indices], edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3);
    closed.push(a + n, c + n, b + n);
    for (const [ea, eb] of [[a,b], [b,c], [c,a]]) {
      const key = ea < eb ? `${ea}:${eb}` : `${eb}:${ea}`;
      const edge = edges.get(key);
      if (edge) edge.count++; else edges.set(key, { a: ea, b: eb, count: 1 });
    }
  }
  for (const { a, b, count } of edges.values()) if (count === 1) closed.push(a, a + n, b, b, a + n, b + n);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setAttribute("leafSide", new Float32BufferAttribute(side, 1));
  g.setIndex(closed); g.computeVertexNormals();
  const youngGeometry = new BufferGeometry();
  youngGeometry.setAttribute("position", new Float32BufferAttribute(juvenilePositions, 3)); youngGeometry.setIndex(closed); youngGeometry.computeVertexNormals();
  g.setAttribute("juvenilePosition", youngGeometry.getAttribute("position"));
  g.setAttribute("juvenileNormal", youngGeometry.getAttribute("normal"));
  // Include both shapes in culling bounds. Morphing never changes topology or instance identity.
  g.computeBoundingBox(); youngGeometry.computeBoundingBox(); g.boundingBox!.union(youngGeometry.boundingBox!);
  g.computeBoundingSphere();
  g.boundingBox!.getBoundingSphere(g.boundingSphere!);
  flat.dispose(); youngGeometry.dispose();
  return g;
}
