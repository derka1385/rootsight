import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, type Vector3 } from "three";
import { seededRandom } from "./procedural";

/** depth: 0 main stem, 1 branch, 2 petiole, 3 flower stalk, 4 pedicel. */
export type StemPath = { id: string; points: Vector3[]; radius: number; taper: number; depth: number };

/**
 * One mesh of organic stems. Each path is a smooth spline with a progressive taper, a flared base on
 * main stems, a slightly oval section that turns along its length and a gentle low-frequency swell
 * (never a random wave). Vertex colours tint it: woody, darker bases on main stems; lighter, greener
 * petioles and stalks. They multiply the material colour.
 */
export function stemGeometry(paths: StemPath[]): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  for (const path of paths) {
    if (path.radius < 1e-8 || path.points[0].distanceToSquared(path.points.at(-1)!) < 1e-14) continue;
    const r = seededRandom(`stem-geometry:${path.id}`);
    const curve = new CatmullRomCurve3(path.points, false, "centripetal");
    const rings = Math.min(28, Math.max(8, Math.round(8 + curve.getLength() * 90)));
    const sides = [10, 9, 8, 7, 6][Math.min(4, path.depth)];
    const frames = curve.computeFrenetFrames(rings, false);
    const phase = r() * 6.28, oval = 0.05 + r() * 0.07, swell = 0.025 + r() * 0.025, turn = (r() - 0.5) * 3;
    // Collar where a stem leaves the soil or its parent: a soft fillet instead of a hard joint.
    const flare = [0.3, 0.38, 0.3, 0.18, 0.1][Math.min(4, path.depth)], collar = [9, 16, 18, 18, 18][Math.min(4, path.depth)];
    const woody = [1, 0.55, 0.12, 0.05, 0][Math.min(4, path.depth)];
    const offset = positions.length / 3;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, center = curve.getPointAt(t);
      const radius = path.radius * (1 - path.taper * Math.pow(t, 1.6)) * (1 + flare * Math.exp(-t * collar)) * (1 + swell * Math.sin(t * 6.1 + phase) * Math.sin(t * 2.3 + phase * 0.7));
      // Woody and darker toward the base of main stems, fresher toward every tip; a slow streaky variation.
      const age = woody * (1 - t) ** 1.4, streak = 1 + 0.045 * Math.sin(t * 13 + phase * 2);
      // Junction occlusion: darker where a stalk leaves its parent, and under the head it carries.
      const shade = (1 - 0.22 * (1 - Math.min(1, t / 0.15))) * (path.depth >= 3 ? 1 - 0.35 * Math.max(0, (t - 0.8) / 0.2) : 1);
      const tint = [(1 - 0.22 * age) * streak * (1 + 0.1 * age) * shade, (1 - 0.3 * age) * streak * shade, (1 - 0.42 * age) * streak * (1 - 0.06 * age) * shade];
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * Math.PI * 2;
        const ellipse = 1 + oval * Math.cos(2 * angle + turn * t + phase);
        const normal = frames.normals[i].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i], Math.sin(angle));
        const point = center.clone().addScaledVector(normal, radius * ellipse);
        positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z); uvs.push(j / sides, t);
        colors.push(tint[0], tint[1], tint[2]);
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
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}
