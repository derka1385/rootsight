import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from "three";

export type StemPath = { id: string; points: Vector3[]; radius: number; taper: number; depth: number };
/** A single low-poly mesh of smoothly tapered splines; no repeated cylinder joints. */
export function stemGeometry(paths: StemPath[]): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rings = 10, sides = 7;
  for (const path of paths) {
    if (path.radius < 1e-8 || path.points[0].distanceToSquared(path.points.at(-1)!) < 1e-14) continue;
    const curve = new CatmullRomCurve3(path.points, false, "centripetal");
    const frames = curve.computeFrenetFrames(rings, false);
    const offset = positions.length / 3;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, center = curve.getPointAt(t);
      const radius = path.radius * (1 - path.taper * t) * (1 + 0.06 * Math.exp(-t * 12));
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * Math.PI * 2;
        const normal = frames.normals[i].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle));
        const point = center.clone().addScaledVector(normal, radius);
        positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z); uvs.push(j / sides, t);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
      const a = offset + i * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    // Close cut ends; branch starts overlap their parent smoothly rather than leaving open tubes.
    for (const ring of [0, rings]) for (let j = 1; j < sides - 1; j++) {
      const a = offset + ring * (sides + 1);
      if (ring === 0) indices.push(a, a + j + 1, a + j); else indices.push(a, a + j, a + j + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}
