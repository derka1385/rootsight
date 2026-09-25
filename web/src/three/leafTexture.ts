import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

// Painted Monstera leaf blades: colour + bump maps drawn on a 2D canvas, used with alphaTest on a
// curved plane. Hand-drawn outlines give smooth margins and splits that follow the veins, which
// reads far more like a real leaf than holes cut into geometry.

const S = 1024;
/** Canvas-space position of the petiole attachment (the sinus between the basal lobes). */
export const ATTACH = { x: 0.5, y: 0.86 };
/** Leaf length (sinus -> tip) as a fraction of the canvas height. */
export const LEAF_FRAC = 0.81;

export type LeafVariant = {
  splits: number; // cuts per side (0 = juvenile entire leaf)
  holes: number; // 0..1 probability of an inner fenestration per gap
  width: number; // half-width relative to length
  seed: number;
};

export const VARIANTS: LeafVariant[] = [
  { splits: 7, holes: 0.8, width: 0.5, seed: 1 },
  { splits: 6, holes: 0.6, width: 0.48, seed: 7 },
  { splits: 7, holes: 0.9, width: 0.52, seed: 13 },
  { splits: 3, holes: 0.2, width: 0.46, seed: 21 }, // young
  { splits: 0, holes: 0, width: 0.44, seed: 5 }, // juvenile heart
];

function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

const cache = new Map<number, { map: Texture; bump: Texture }>();

export function leafTextures(i: number) {
  let t = cache.get(i);
  if (!t) cache.set(i, (t = paint(VARIANTS[i])));
  return t;
}

function paint(v: LeafVariant) {
  const rand = rng(v.seed);
  const L = S * LEAF_FRAC;
  const ox = S * ATTACH.x;
  const oy = S * ATTACH.y;
  const W = L * v.width;
  // leaf-space (x right, y toward tip) -> canvas
  const P = (x: number, y: number): [number, number] => [ox + x, oy - y];

  // Right half outline (tip -> shoulder -> basal lobe -> sinus) as cubic segments [c1, c2, end];
  // the left half walks the same segments backwards, mirrored and slightly narrower.
  const segs = [
    [[0.3, 0.93], [0.85, 0.72], [1, 0.42]],
    [[1.03, 0.16], [0.82, -0.1], [0.42, -0.1]],
    [[0.2, -0.1], [0.05, -0.03], [0, 0]],
  ];
  const pts = [[0, 1], ...segs.flat()]; // start point + (c1, c2, end) triples
  const outline = (ctx: CanvasRenderingContext2D) => {
    const Q = ([x, y]: number[], k: number) => P(x * W * k, y * L);
    ctx.beginPath();
    ctx.moveTo(...Q(pts[0], 1));
    for (let i = 1; i < pts.length; i += 3) ctx.bezierCurveTo(...Q(pts[i], 1), ...Q(pts[i + 1], 1), ...Q(pts[i + 2], 1));
    for (let i = pts.length - 1; i > 0; i -= 3) ctx.bezierCurveTo(...Q(pts[i - 1], -0.95), ...Q(pts[i - 2], -0.95), ...Q(pts[i - 3], -0.95));
    ctx.closePath();
  };

  // Lateral veins: start on the midrib, sweep outward and curve toward the tip.
  type Vein = { y0: number; side: number; ang: number };
  const veins: Vein[] = [];
  const nV = Math.max(v.splits, 4) + 1;
  for (const side of [-1, 1])
    for (let k = 0; k < nV; k++) {
      const f = (k + 0.5) / nV;
      veins.push({ y0: L * (0.02 + 0.8 * f), side, ang: -0.25 + 1.0 * f + (rand() - 0.5) * 0.08 });
    }
  const veinPt = (vn: Vein, a: number): [number, number] => {
    // a: distance along the vein in units of W; bend upward toward the margin
    const ang = vn.ang + a * a * 0.35;
    return [vn.side * Math.cos(ang) * a * W, vn.y0 + Math.sin(ang) * a * W * 0.9 + a * a * W * 0.12];
  };

  // ---- colour map ----
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  outline(ctx);
  const g = ctx.createLinearGradient(ox, oy + L * 0.1, ox, oy - L);
  g.addColorStop(0, "#2f6a36");
  g.addColorStop(0.5, "#2a6231");
  g.addColorStop(1, "#23552b");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // lighter toward the midrib, darker toward the margin
  const rg = ctx.createLinearGradient(ox - W, 0, ox + W, 0);
  rg.addColorStop(0, "rgba(10,30,14,0.35)");
  rg.addColorStop(0.5, "rgba(120,170,90,0.12)");
  rg.addColorStop(1, "rgba(10,30,14,0.35)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, S, S);
  // soft mottling so the surface isn't a flat fill
  for (let i = 0; i < 260; i++) {
    const [x, y] = P((rand() - 0.5) * 2 * W, rand() * L * 1.1 - L * 0.1);
    const r = 6 + rand() * 30;
    ctx.fillStyle = rand() > 0.5 ? "rgba(90,140,70,0.05)" : "rgba(8,25,10,0.06)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // lateral veins
  ctx.lineCap = "round";
  for (const vn of veins) {
    ctx.strokeStyle = "rgba(170,205,120,0.28)";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let a = 0; a <= 1.25; a += 0.05) ctx.lineTo(...P(...veinPt(vn, a)));
    ctx.stroke();
  }
  // midrib, tapering to the tip
  for (let i = 0; i < 20; i++) {
    const y1 = (L * i) / 20;
    const y2 = (L * (i + 1)) / 20;
    ctx.strokeStyle = "rgba(185,215,130,0.55)";
    ctx.lineWidth = 13 * (1 - i / 22);
    ctx.beginPath();
    ctx.moveTo(...P(0, y1 - 2));
    ctx.lineTo(...P(0, y2));
    ctx.stroke();
  }
  ctx.restore();
  // darker margin line
  outline(ctx);
  ctx.strokeStyle = "rgba(15,40,18,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // ---- cuts + holes (erase from colour map) ----
  const cuts = (k: CanvasRenderingContext2D) => {
    if (!v.splits) return;
    k.save();
    k.globalCompositeOperation = "destination-out";
    k.fillStyle = "#000";
    for (const side of [-1, 1]) {
      for (let i = 0; i < v.splits; i++) {
        // cut sits halfway between two veins
        const f = (i + 1) / (v.splits + 1);
        if (f > 0.9) continue;
        const vn: Vein = { y0: L * (0.02 + 0.82 * f), side, ang: -0.2 + 1.0 * f + (rand() - 0.5) * 0.1 };
        const aIn = 0.42 + rand() * 0.18 - (f < 0.2 ? -0.1 : 0);
        const left: [number, number][] = [];
        const right: [number, number][] = [];
        for (let a = aIn; a <= 1.5; a += 0.04) {
          const [x, y] = veinPt(vn, a);
          const [x2, y2] = veinPt(vn, a + 0.01);
          const len = Math.hypot(x2 - x, y2 - y) || 1;
          const nx = -(y2 - y) / len;
          const ny = (x2 - x) / len;
          const w = W * (0.02 + 0.075 * Math.max(0, (a - aIn) / (1.1 - aIn)) ** 1.6);
          left.push(P(x + nx * w, y + ny * w));
          right.push(P(x - nx * w, y - ny * w));
        }
        k.beginPath();
        left.forEach((p, j) => (j ? k.lineTo(...p) : k.moveTo(...p)));
        right.reverse().forEach((p) => k.lineTo(...p));
        k.closePath();
        k.fill();
        const [cx, cy] = P(...veinPt(vn, aIn));
        k.beginPath();
        k.arc(cx, cy, W * 0.018, 0, Math.PI * 2);
        k.fill();
        // inner fenestration, elongated along the vein line
        if (rand() < v.holes && f > 0.12 && f < 0.8) {
          const a0 = aIn * (0.38 + rand() * 0.1);
          const [hx, hy] = veinPt(vn, a0);
          const [hx2, hy2] = veinPt(vn, a0 + 0.05);
          k.save();
          k.translate(...P(hx, hy));
          k.rotate(-Math.atan2(hy2 - hy, hx2 - hx));
          k.beginPath();
          k.ellipse(0, 0, W * (0.07 + rand() * 0.04), W * 0.026, 0, 0, Math.PI * 2);
          k.fill();
          k.restore();
        }
      }
    }
    k.restore();
  };
  cuts(ctx);

  // ---- bump map: veins sit in shallow grooves ----
  const b = document.createElement("canvas");
  b.width = b.height = S;
  const bx = b.getContext("2d")!;
  bx.fillStyle = "#808080";
  bx.fillRect(0, 0, S, S);
  bx.lineCap = "round";
  bx.strokeStyle = "#5a5a5a";
  for (const vn of veins) {
    bx.lineWidth = 6;
    bx.beginPath();
    for (let a = 0; a <= 1.25; a += 0.05) bx.lineTo(...P(...veinPt(vn, a)));
    bx.stroke();
  }
  bx.strokeStyle = "#a8a8a8"; // raised midrib
  bx.lineWidth = 12;
  bx.beginPath();
  bx.moveTo(...P(0, 0));
  bx.lineTo(...P(0, L));
  bx.stroke();

  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new CanvasTexture(b);
  return { map, bump };
}
