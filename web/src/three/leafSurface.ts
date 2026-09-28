import { CanvasTexture, Color, DoubleSide, MeshPhysicalMaterial, NoColorSpace, SRGBColorSpace, Vector2 } from "three";
import type { RenderProfile as PlantProfile } from "./visual";
import type { Visual } from "./visual";
import { deformLeaf } from "./leafDeformation";
import { seededRandom, smoothstep } from "./procedural";
import { thinTissue } from "./shading";

const veinNormals = new Map<string, CanvasTexture>();
/**
 * Tangent-space normal map of the vein relief (midrib and lateral veins sunk into the blade), shared by
 * every leaf with the same venation. Same (u across, v along) layout as the painted surface.
 */
function veinNormal(venation: Visual["leaves"]["venation"]): CanvasTexture {
  const hit = veinNormals.get(venation);
  if (hit) return hit;
  const W = 128, H = 256, height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / (W - 1), t = 1 - y / (H - 1), d = Math.abs(u - 0.5);
    let h = -Math.exp(-(((d * W) / 1.6) ** 2)) * 1.2; // midrib groove
    if (venation === "parallel") h -= 0.35 * Math.pow(Math.max(0, Math.cos(d * W * 0.42)), 18);
    else if (venation === "pinnate") {
      // Lateral veins leave the midrib and curve toward the tip.
      const phase = (t - d * 0.55) * 18;
      h -= 0.45 * Math.pow(Math.max(0, Math.cos(phase * Math.PI)), 24) * smoothstep(0.02, 0.06, d) * (1 - smoothstep(0.4, 0.5, d));
    }
    height[y * W + x] = h;
  }
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!, image = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const at = (xx: number, yy: number) => height[Math.min(H - 1, Math.max(0, yy)) * W + Math.min(W - 1, Math.max(0, xx))];
    const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5, dy = (at(x, y - 1) - at(x, y + 1)) * 0.5;
    const n = [-dx, -dy, 1], len = Math.hypot(n[0], n[1], n[2]), o = (y * W + x) * 4;
    image.data[o] = (n[0] / len * 0.5 + 0.5) * 255; image.data[o + 1] = (n[1] / len * 0.5 + 0.5) * 255; image.data[o + 2] = (n[2] / len * 0.5 + 0.5) * 255; image.data[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  veinNormals.set(venation, texture);
  return texture;
}

/** Four shared age/condition surfaces per plant. Textures are owned and disposed with the plant. */
export function leafSurface(p: PlantProfile, v: Visual, age: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(128, 256);
  const base = new Color(p.morphology.leaf.color).offsetHSL(0, -0.045, (3 - age) * 0.009);
  const yellow = new Color("#b7a044"), brown = new Color("#755039"), patch = new Color(v.leaves.variegationColor);
  const c = new Color();
  const random = seededRandom(v.seed + ":surface:" + age);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
    const u = x / 127, t = 1 - y / 255, edge = Math.abs(u - 0.5) * 2;
    const field = 0.5 + 0.22 * Math.sin(u * 27 + Math.sin(t * 18 + age) * 3) + 0.18 * Math.cos(t * 39 + u * 13) + 0.1 * Math.sin(t * 73 - u * 61);
    // Marbling is soft, blotchy and follows the leaf (a silver zone inside the margin), not stripes.
    const blotch = 0.5 + 0.3 * Math.sin(u * 7.5 + Math.sin(t * 5 + age) * 1.6) * Math.cos(t * 6.5 - u * 3) + 0.2 * Math.sin((edge * 5.5 + t * 2.5) + age);
    const amount = v.leaves.variegationAmount;
    let mask = 0;
    switch (v.leaves.variegation) {
      case "sectoral": mask = smoothstep(1 - amount - 0.04, 1 - amount + 0.04, u + Math.sin(t * 13 + age) * 0.06); break;
      case "margin": mask = smoothstep(1 - amount, 1 - amount + 0.05, edge); break;
      case "striped": mask = smoothstep(1 - amount, 1 - amount + 0.06, 0.5 + 0.5 * Math.sin(t * 75 + Math.sin(u * 18) * 2)); break;
      case "marbled": mask = 0.7 * smoothstep(1 - amount - 0.12, 1 - amount + 0.12, blotch) * smoothstep(0.95, 0.55, edge); break;
    }
    if (amount === 0) mask = 0;
    const chlorosis = v.condition.yellowing * (0.25 + age * 0.25) * (0.5 + 0.5 * field);
    const tip = smoothstep(1 - v.condition.brownTips * (0.08 + age * 0.09), 1.005, t + field * v.condition.brownTips * 0.055);
    c.copy(base).lerp(patch, mask).lerp(yellow, chlorosis).lerp(brown, tip);
    // Soft vein relief stays subtle at phone scale; no opaque white midrib.
    const veins = (v.leaves.venation === "subtle" ? 0.2 : 1) * (Math.exp(-Math.abs(u - 0.5) * 170) * 0.12 + Math.pow(Math.max(0, Math.cos((t - edge * 0.15) * 63)), 24) * 0.08);
    c.multiplyScalar(0.92 + random() * 0.035 + veins - Math.exp(-Math.abs(u - 0.5) * 30) * 0.06).convertLinearToSRGB();
    const offset = (y * 128 + x) * 4;
    pixels.data[offset] = c.r * 255; pixels.data[offset + 1] = c.g * 255; pixels.data[offset + 2] = c.b * 255; pixels.data[offset + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  ctx.strokeStyle = "rgba(195,209,143,0.26)";
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(64, 256); ctx.quadraticCurveTo(65, 130, 64, 0); ctx.stroke();
  for (let i = 1; i < (v.leaves.venation === "subtle" ? 1 : 9); i++) for (const side of [-1, 1]) {
    const y = 256 - i * 26;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    if (v.leaves.venation === "parallel") { ctx.moveTo(64 + side * i * 5, 256); ctx.lineTo(64 + side * i * 4, 0); }
    else { ctx.moveTo(64, y); ctx.quadraticCurveTo(64 + side * 24, y - 10, 64 + side * 56, y - 40); }
    ctx.stroke();
  }
  const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 2;
  // A waxy cuticle on glossy leaves (clearcoat), a faint velvet on matte ones (sheen); veins in relief.
  const gloss = v.leaves.gloss;
  const material = new MeshPhysicalMaterial({
    map, normalMap: veinNormal(v.leaves.venation), normalScale: new Vector2(0.55, 0.55), side: DoubleSide, metalness: 0,
    roughness: 0.68 - gloss * 0.3, clearcoat: 0.03 + gloss * 0.3, clearcoatRoughness: 0.42 - gloss * 0.2,
    sheen: 0.12 * (1 - gloss), sheenRoughness: 0.75, sheenColor: new Color(p.morphology.leaf.color).lerp(new Color("#ffffff"), 0.35),
    specularIntensity: 0.45,
  });
  material.forceSinglePass = true;
  const underside = new Color(v.leaves.undersideColor);
  material.onBeforeCompile = shader => {
    deformLeaf(shader);
    thinTissue(shader, 0.5, 0.4);
    shader.uniforms.underside = { value: underside };
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + 0.035 * sin(vMapUv.y * 31.0 + vMapUv.x * 9.0), 0.35, 1.0);");
    shader.fragmentShader = "uniform vec3 underside; varying float bladeSide;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\nif (bladeSide < 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, underside * diffuseColor.rgb / max(vec3(0.04), vec3(" + `${base.r},${base.g},${base.b}` + ")), 0.65);");
  };
  material.customProgramCacheKey = () => `leaf-v2:${base.getHexString()}`;
  return material;
}
