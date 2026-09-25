import { BufferGeometry, CylinderGeometry, Float32BufferAttribute } from "three";

/** Deterministic RNG seeded from a string, so the same species always grows the same plant. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Unit stem segment: base at y = 0, top at y = 1, top radius 0.82 of the base.
 * Chains of scaled segments give tapered, bendable stems with one shared geometry.
 */
export const SEGMENT = new CylinderGeometry(0.82, 1, 1, 7, 1).translate(0, 0.5, 0);
export const SEGMENT_TAPER = 0.82;

export type LeafForm = "ovate" | "cordate" | "lanceolate" | "needle";

const WIDTH: Record<LeafForm, number> = { ovate: 0.62, cordate: 0.95, lanceolate: 0.24, needle: 0.08 };

const cache = new Map<string, BufferGeometry>();

/**
 * Procedural leaf blade, base at the origin, tip at z = 1, top face towards +y.
 * Tapered tip, widest before the middle, V-fold along the midrib and a downward arch.
 * `split` cuts monstera-style slits from the margin towards the midrib.
 */
export function leafGeometry(form: LeafForm, split = false): BufferGeometry {
  const key = `${form}:${split}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rows = split ? 20 : 12;
  const cols = 8; // across the blade, midrib in the middle
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ratio = WIDTH[form];

  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    let w: number;
    if (form === "cordate") w = Math.pow(Math.sin(Math.PI * Math.pow(0.1 + 0.9 * t, 0.72)), 0.7);
    else if (form === "ovate") w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.85);
    else w = Math.pow(Math.sin(Math.PI * t), 1.1);
    for (let c = 0; c <= cols; c++) {
      const s = (c / cols) * 2 - 1; // -1 margin, 0 midrib, 1 margin
      const x = s * w * ratio * 0.5;
      // Heart-shaped leaves: pull the basal margin back to form two lobes.
      const lobe = form === "cordate" ? 0.14 * Math.pow(Math.abs(s), 1.5) * Math.pow(1 - t, 5) : 0;
      const z = t - lobe;
      // Margins sit slightly higher than the midrib; the tip arches down.
      const y = 0.09 * ratio * Math.abs(s) * w - 0.12 * t * t;
      pos.push(x, y, z);
      uv.push((s + 1) / 2, t);
    }
  }

  const slitRows = split ? new Set([5, 8, 11, 14]) : new Set<number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = Math.abs(((c + 0.5) / cols) * 2 - 1);
      if (slitRows.has(r) && s > 0.35) continue; // leave a gap: one split
      const a = r * (cols + 1) + c;
      const b = a + cols + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  cache.set(key, g);
  return g;
}
