import { MathUtils, TubeGeometry, Vector3, type Curve } from "three";

/** TubeGeometry whose radius tapers from r0 to r1, with a slight flare at the base. */
export function taperedTube(curve: Curve<Vector3>, r0: number, r1: number, seg = 28, radial = 8) {
  const g = new TubeGeometry(curve, seg, 1, radial, false);
  const p = g.attributes.position;
  const c = new Vector3();
  const v = new Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, c);
    const r = MathUtils.lerp(r0, r1, t) * (1 + 0.35 * (1 - t) ** 6); // flared base
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}
