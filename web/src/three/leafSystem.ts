import { BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, MeshDepthMaterial, MeshPhysicalMaterial, RGBADepthPacking, SRGBColorSpace, type Texture, type WebGLProgramParametersWithUniforms } from "three";
import { clamp01, seededRandom, smoothstep } from "./procedural";

/*
 * Leaf surface system. A blade is a parametric (s, t) sheet: t runs base -> tip along the midrib,
 * s runs margin -> midrib -> margin. The mesh follows the real outline (tapered base, lobes, tip),
 * so the silhouette is geometric and crisp; splits and holes are cut by the alpha channel of a
 * per-plant painted texture, so they follow the veins and cast matching shadows.
 *
 * Local frame: petiole attachment at the origin, midrib along +z (length 1), upper face +y.
 */

export type LeafShape = {
  /** Blade width / length. */
  widthToLength: number;
  /** Where along the midrib the blade is widest (0..1). */
  widest: number;
  /** Width at the base relative to the widest point: 0 wedge, ~0.6 heart. */
  baseWidth: number;
  /** How far the basal lobes reach back past the petiole, as a fraction of length. */
  lobe: number;
  /** 0 blunt, 1 long drip tip. */
  acumen: number;
  /** One half wider than the other: -0.2..0.2. */
  asymmetry: number;
  /** Longitudinal curvature: the tip hangs below the base. */
  arch: number;
  /** Transverse curvature: + halves slope down to the margin, - cupped up. */
  cup: number;
  /** V-fold along the midrib: halves rise away from it. */
  fold: number;
  /** Wavy margin amplitude. */
  undulation: number;
  twist: number;
  seed: string;
};

const ROWS = 40, HALF = 11; // 41 x 23 vertices, ~1.8k triangles per blade

/** Half-width of the blade at t, as a fraction of the widest half-width. */
export function widthProfile(t: number, s: LeafShape): number {
  if (t <= s.widest) return s.baseWidth + (1 - s.baseWidth) * Math.sin((Math.PI / 2) * (t / s.widest)) ** 0.85;
  const u = (t - s.widest) / (1 - s.widest);
  // Convex shoulders, then an acuminate drip tip that narrows faster than an ellipse.
  return Math.cos((Math.PI / 2) * u) ** (0.9 + s.acumen * 0.5) * (1 - s.acumen * 0.35 * smoothstep(0.55, 1, u));
}

export function leafGeometry(shape: LeafShape): BufferGeometry {
  const rand = seededRandom(shape.seed + ":blade");
  const phase = rand() * 6.28, freq = 5 + rand() * 4;
  const half = shape.widthToLength / 2;
  const pos: number[] = [], uv: number[] = [], index: number[] = [];
  for (let r = 0; r <= ROWS; r++) {
    // Denser rows near the base and tip, where the outline turns fastest.
    const t = 0.5 - 0.5 * Math.cos((Math.PI * r) / ROWS);
    for (let c = -HALF; c <= HALF; c++) {
      const s = c / HALF, side = Math.sign(s) || 1;
      const w = widthProfile(t, shape) * half * (1 + shape.asymmetry * side);
      const x = s * w;
      // Basal lobes swing back past the attachment; the sinus stays on the midrib.
      const z = t - shape.lobe * Math.abs(s) ** 1.6 * (1 - t) ** 3;
      const a = Math.abs(x) / half;
      const y = shape.fold * Math.abs(x) - shape.cup * x * x - shape.arch * t * t
        + 0.05 * shape.lobe * Math.max(0, -z) / Math.max(0.01, shape.lobe)
        + shape.undulation * a ** 3 * Math.sin(t * freq * 6.28 + phase + side)
        + shape.twist * x * t;
      pos.push(x, y, z);
      uv.push((s + 1) / 2, t);
    }
  }
  const cols = 2 * HALF + 1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + cols;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/* ---------- Venation and fenestration, in (s, t) texture space ---------- */

export type Venation = { veins: { t0: number; rise: number }[] };

/** Pinnate lateral veins shared by every leaf of a plant (same species, same pattern). */
export function venation(seed: string, count = 8): Venation {
  const rand = seededRandom(seed + ":veins");
  return {
    veins: Array.from({ length: count }, (_, k) => {
      const f = (k + 0.5) / count;
      // Basal veins run out sideways (into the lobes), upper ones sweep towards the tip.
      const t0 = 0.03 + 0.8 * f + (rand() - 0.5) * 0.05;
      // Upper veins must reach the margin before the tip, or they bunch into arcs where it narrows.
      return { t0, rise: Math.min(0.9 - t0, -0.06 + 0.4 * f ** 0.8 + (rand() - 0.5) * 0.04) };
    }),
  };
}

/** Point on a lateral vein (or a gap between two) at a in [0,1], midrib to margin. */
const veinPoint = (t0: number, rise: number, a: number): [number, number] => [a, t0 + rise * a ** 1.3];

/**
 * Maturity-driven fenestration (heteroblasty): juvenile leaves are entire, then holes open
 * along the midrib, then marginal splits deepen between the veins, then a second row of holes.
 */
export function fenestrationOf(formMaturity: number, amount: number) {
  const m = clamp01(formMaturity), k = clamp01(amount * 1.4);
  return {
    innerHoles: smoothstep(0.2, 0.55, m) * k,
    splits: smoothstep(0.38, 0.75, m) * k,
    splitDepth: 0.25 + 0.43 * smoothstep(0.4, 1, m),
    outerHoles: smoothstep(0.72, 0.95, m) * k,
  };
}

const S = 512;

/** Colour + cut-out (alpha) map for one fenestration level. Leaf colour is baked in. */
export function leafAlbedo(opts: { seed: string; formMaturity: number; fenestration: number; color: string; venation: Venation; variegation?: { kind: string; amount: number; color: string }; brownTips?: number }): Texture {
  const { venation: ven } = opts;
  const rand = seededRandom(opts.seed + ":paint:" + opts.formMaturity.toFixed(2));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const base = new Color(opts.color);
  const css = (c: Color) => `#${c.getHexString()}`;
  // Texture space: x = (s+1)/2 * S, y = (1 - t) * S (canvas rows are flipped on upload).
  const P = (s: number, t: number): [number, number] => [(s + 1) / 2 * S, (1 - t) * S];

  // Base: lighter along the midrib, darker towards the margin, lighter/yellower near the base.
  const across = ctx.createLinearGradient(0, 0, S, 0);
  const dark = base.clone().offsetHSL(0, 0.02, -0.035), light = base.clone().offsetHSL(0.01, 0, 0.03);
  across.addColorStop(0, css(dark)); across.addColorStop(0.5, css(light)); across.addColorStop(1, css(dark));
  ctx.fillStyle = across; ctx.fillRect(0, 0, S, S);
  const along = ctx.createLinearGradient(0, S, 0, 0);
  along.addColorStop(0, "rgba(190,210,120,0.10)"); along.addColorStop(0.35, "rgba(0,0,0,0)"); along.addColorStop(1, "rgba(0,20,0,0.08)");
  ctx.fillStyle = along; ctx.fillRect(0, 0, S, S);
  // Soft mottling so large blades never read as a flat fill.
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(150,190,110,0.045)" : "rgba(0,25,5,0.05)";
    ctx.beginPath(); ctx.arc(rand() * S, rand() * S, 4 + rand() * 26, 0, 6.29); ctx.fill();
  }
  if (opts.variegation && opts.variegation.kind !== "none" && opts.variegation.amount > 0) {
    ctx.fillStyle = opts.variegation.color;
    const amount = opts.variegation.amount;
    if (opts.variegation.kind === "sectoral") { ctx.globalAlpha = 0.95; ctx.fillRect(S * (1 - amount), 0, S * amount, S); }
    else if (opts.variegation.kind === "margin") { ctx.globalAlpha = 0.9; ctx.fillRect(0, 0, S * amount * 0.5, S); ctx.fillRect(S * (1 - amount * 0.5), 0, S, S); }
    else for (let i = 0; i < 60 * amount; i++) { ctx.globalAlpha = 0.5 + rand() * 0.5; ctx.beginPath(); ctx.ellipse(rand() * S, rand() * S, 3 + rand() * 14, 2 + rand() * 6, rand() * 3, 0, 6.29); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // Veins: pale yellow-green, midrib widest and tapering to the tip.
  ctx.lineCap = "round";
  const vein = base.clone().lerp(new Color("#d8e6a0"), 0.45);
  ctx.strokeStyle = css(vein);
  for (let i = 0; i < 24; i++) {
    const t0 = i / 24, t1 = (i + 1) / 24;
    ctx.lineWidth = 7 * (1 - t0) + 1.2;
    ctx.beginPath(); ctx.moveTo(...P(0, t0)); ctx.lineTo(...P(0, t1)); ctx.stroke();
  }
  ctx.globalAlpha = 0.55;
  for (const side of [-1, 1]) for (const v of ven.veins) {
    ctx.lineWidth = 2.2 * (1 - v.t0 * 0.5);
    ctx.beginPath();
    for (let a = 0; a <= 1.001; a += 0.05) { const [s, t] = veinPoint(v.t0, v.rise, a); ctx.lineTo(...P(side * s, t)); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (opts.brownTips) {
    const tip = ctx.createLinearGradient(0, S * 0.12 * opts.brownTips, 0, 0);
    tip.addColorStop(0, "rgba(120,80,45,0)"); tip.addColorStop(1, "rgba(120,80,45,0.95)");
    ctx.fillStyle = tip; ctx.fillRect(0, 0, S, S * 0.12 * opts.brownTips + 1);
  }

  // Cut-outs: erase alpha between the veins.
  const f = fenestrationOf(opts.formMaturity, opts.fenestration);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  const gaps = ven.veins.slice(0, -1).map((v, k) => ({ t0: (v.t0 + ven.veins[k + 1].t0) / 2, rise: (v.rise + ven.veins[k + 1].rise) / 2, k }));
  const n = gaps.length;
  for (const side of [-1, 1]) for (const g of gaps) {
    const r = seededRandom(`${opts.seed}:gap:${side}:${g.k}`);
    const along = (g.k + 0.5) / n;
    // Splits open first mid-blade, last near the base and the tip.
    const bias = Math.sin(Math.PI * (0.15 + 0.8 * along));
    if (r() < f.splits * (0.55 + 0.6 * bias)) {
      const depth = f.splitDepth * (0.75 + 0.35 * r()) * (0.7 + 0.3 * bias);
      const a0 = Math.max(0.3, 1 - depth);
      const left: [number, number][] = [], right: [number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const a = a0 + (1.08 - a0) * (i / 12);
        const [s, t] = veinPoint(g.t0, g.rise, a);
        const [x, y] = P(side * s, t);
        const [x2, y2] = P(side * (s + 0.01), veinPoint(g.t0, g.rise, a + 0.01)[1]);
        const len = Math.hypot(x2 - x, y2 - y) || 1, nx = -(y2 - y) / len, ny = (x2 - x) / len;
        // Narrow and rounded inside, opening up as the segments spread towards the margin.
        const w = (2.5 + 13 * ((a - a0) / (1.08 - a0)) ** 1.8) * (0.7 + 0.6 * r());
        left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w]);
      }
      ctx.beginPath();
      left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      right.reverse().forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath(); ctx.fill();
      const [cx, cy] = P(side * veinPoint(g.t0, g.rise, a0)[0], veinPoint(g.t0, g.rise, a0)[1]);
      ctx.beginPath(); ctx.arc(cx, cy, 2.7, 0, 6.29); ctx.fill();
    }
    const hole = (a: number, size: number) => {
      const [s, t] = veinPoint(g.t0, g.rise, a), [s2, t2] = veinPoint(g.t0, g.rise, a + 0.02);
      const [x, y] = P(side * s, t), [x2, y2] = P(side * s2, t2);
      // Elongated along the gap, a little egg-shaped: two offset ellipses.
      const angle = Math.atan2(y2 - y, x2 - x), ca = Math.cos(angle), sa = Math.sin(angle);
      ctx.beginPath(); ctx.ellipse(x, y, size * 24, size * 7.5, angle, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + ca * size * 8, y + sa * size * 8, size * 15, size * 9, angle, 0, 6.29); ctx.fill();
    };
    if (along > 0.08 && along < 0.9 && r() < f.innerHoles) hole(0.24 + r() * 0.08, 0.7 + 0.5 * r());
    if (along > 0.15 && along < 0.8 && r() < f.outerHoles) hole(0.48 + r() * 0.08, 0.5 + 0.4 * r());
  }
  ctx.globalCompositeOperation = "source-over";
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

/** Tangent-space normal map: impressed lateral veins, raised midrib, quilted areoles between. */
export function leafNormal(ven: Venation): Texture {
  const N = 256;
  const height = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const s = (x / (N - 1)) * 2 - 1, t = 1 - y / (N - 1), a = Math.abs(s);
    let d = 1;
    for (const v of ven.veins) d = Math.min(d, Math.abs(t - (v.t0 + v.rise * a ** 1.3)));
    const lateral = Math.exp(-((d / 0.012) ** 2)) * (1 - 0.5 * a);
    const midrib = Math.exp(-((a / 0.035) ** 2));
    height[y * N + x] = 0.55 * midrib - 0.6 * lateral + 0.25 * Math.min(1, d / 0.05);
  }
  const data = new Uint8ClampedArray(N * N * 4);
  const h = (x: number, y: number) => height[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 2.2, dy = (h(x, y - 1) - h(x, y + 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1), o = (y * N + x) * 4;
    data[o] = (-dx / l * 0.5 + 0.5) * 255; data[o + 1] = (-dy / l * 0.5 + 0.5) * 255; data[o + 2] = (1 / l * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  canvas.getContext("2d")!.putImageData(new ImageData(data, N, N), 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

/* ---------- Materials ---------- */

/**
 * Per-instance roll (attribute aRoll, curvature in 1/length units) curls both halves of the blade
 * around the midrib: a new leaf unfurls from a rolled spike, a wilting leaf folds its halves down.
 * Applied to the depth material too, so shadows match the rolled shape.
 */
function patchRoll(shader: WebGLProgramParametersWithUniforms, normals: boolean) {
  shader.vertexShader = "attribute float aRoll;\n" + shader.vertexShader;
  if (normals) shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
    { float th = position.x * aRoll; float c = cos(th), s = sin(th);
      objectNormal = vec3(objectNormal.x * c - objectNormal.y * s, objectNormal.x * s + objectNormal.y * c, objectNormal.z); }`);
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
    if (abs(aRoll) > 1e-4) { float th = position.x * aRoll; float c = cos(th), s = sin(th);
      transformed = vec3(s / aRoll - position.y * s, (1.0 - c) / aRoll + position.y * c, position.z); }`);
}

export function leafMaterial(map: Texture, normalMap: Texture, opts: { gloss: number; underside: string }) {
  const material = new MeshPhysicalMaterial({
    map, normalMap, alphaTest: 0.5, side: DoubleSide,
    roughness: 0.62 - opts.gloss * 0.3, metalness: 0,
    // A waxy cuticle: glossy aroids get a sharp secondary highlight on top of the diffuse leaf.
    clearcoat: opts.gloss * 0.35, clearcoatRoughness: 0.42,
    sheen: 0.25, sheenRoughness: 0.6, sheenColor: new Color("#cfe8b0"),
    envMapIntensity: 0.9,
  });
  material.normalScale.set(0.9, 0.9);
  const underside = new Color(opts.underside);
  material.onBeforeCompile = shader => {
    patchRoll(shader, true);
    // Thin blades: light wraps past the terminator and back-lit leaves glow rather than go black.
    shader.fragmentShader = shader.fragmentShader.replace(
      "vec3 irradiance = dotNL * directLight.color;",
      `float wrapNL = saturate((dot(geometryNormal, directLight.direction) + 0.45) / 1.45);
       float backNL = saturate(-dot(geometryNormal, directLight.direction));
       vec3 irradiance = (mix(dotNL, wrapNL, 0.55) + backNL * 0.7) * directLight.color;`,
    );
    shader.uniforms.leafUnderside = { value: underside };
    shader.fragmentShader = "uniform vec3 leafUnderside;\n" + shader.fragmentShader.replace(
      "#include <map_fragment>",
      // Undersides are paler and matte-looking; keep the painted veins by tinting, not replacing.
      "#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = leafUnderside * (0.75 + 1.6 * dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1)));",
    );
  };
  material.customProgramCacheKey = () => "rootsight-leaf-v1";
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  depth.onBeforeCompile = shader => patchRoll(shader, false);
  depth.customProgramCacheKey = () => "rootsight-leaf-depth-v1";
  return { material, depth };
}
