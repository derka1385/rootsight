import { CanvasTexture, Color, DoubleSide, MeshStandardMaterial, SRGBColorSpace } from "three";
import type { RenderProfile as PlantProfile } from "./visual";
import type { Visual } from "./visual";
import { seededRandom, smoothstep } from "./procedural";

/** Four shared age/condition surfaces per plant. Textures are owned and disposed with the plant. */
export function leafSurface(p: PlantProfile, v: Visual, age: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(128, 256);
  const base = new Color(p.morphology.leaf.color).offsetHSL(0, -0.05, (3 - age) * 0.03);
  const yellow = new Color("#b7a044"), brown = new Color("#755039"), patch = new Color(v.leaves.variegationColor);
  const c = new Color();
  const random = seededRandom(v.seed + ":surface:" + age);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
    const u = x / 127, t = 1 - y / 255, edge = Math.abs(u - 0.5) * 2;
    const field = 0.5 + 0.22 * Math.sin(u * 27 + Math.sin(t * 18 + age) * 3) + 0.18 * Math.cos(t * 39 + u * 13) + 0.1 * Math.sin(t * 73 - u * 61);
    const amount = v.leaves.variegationAmount;
    let mask = 0;
    switch (v.leaves.variegation) {
      case "sectoral": mask = smoothstep(1 - amount - 0.04, 1 - amount + 0.04, u + Math.sin(t * 13 + age) * 0.06); break;
      case "margin": mask = smoothstep(1 - amount, 1 - amount + 0.05, edge); break;
      case "striped": mask = smoothstep(1 - amount, 1 - amount + 0.06, 0.5 + 0.5 * Math.sin(t * 75 + Math.sin(u * 18) * 2)); break;
      case "marbled": mask = smoothstep(1 - amount - 0.06, 1 - amount + 0.06, field); break;
    }
    if (amount === 0) mask = 0;
    const chlorosis = v.condition.yellowing * (0.25 + age * 0.25) * (0.5 + 0.5 * field);
    const tip = smoothstep(1 - v.condition.brownTips * (0.08 + age * 0.09), 1.005, t + field * v.condition.brownTips * 0.055);
    c.copy(base).lerp(patch, mask).lerp(yellow, chlorosis).lerp(brown, tip);
    // Soft vein relief stays subtle at phone scale; no opaque white midrib.
    const veins = Math.exp(-Math.abs(u - 0.5) * 170) * 0.12 + Math.pow(Math.max(0, Math.cos((t - edge * 0.15) * 63)), 24) * 0.08;
    c.multiplyScalar(0.92 + random() * 0.045 + veins).convertLinearToSRGB();
    const offset = (y * 128 + x) * 4;
    pixels.data[offset] = c.r * 255; pixels.data[offset + 1] = c.g * 255; pixels.data[offset + 2] = c.b * 255; pixels.data[offset + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  ctx.strokeStyle = "rgba(195,209,143,0.26)";
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(64, 256); ctx.quadraticCurveTo(65, 130, 64, 0); ctx.stroke();
  for (let i = 1; i < 9; i++) for (const side of [-1, 1]) {
    const y = 256 - i * 26;
    ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.moveTo(64, y); ctx.quadraticCurveTo(64 + side * 24, y - 10, 64 + side * 56, y - 40); ctx.stroke();
  }
  const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 2;
  const material = new MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.0015, roughness: 0.9 - v.leaves.gloss * 0.6, side: DoubleSide, metalness: 0, envMapIntensity: 0.5 + v.leaves.gloss * 1.3, emissive: new Color(p.morphology.leaf.color), emissiveIntensity: 0.04 });
  material.forceSinglePass = true;
  const underside = new Color(v.leaves.undersideColor);
  material.onBeforeCompile = shader => {
    shader.uniforms.underside = { value: underside };
    shader.fragmentShader = "uniform vec3 underside;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, underside * diffuseColor.rgb / max(vec3(0.04), vec3(" + `${base.r},${base.g},${base.b}` + ")), 0.65);");
  };
  material.customProgramCacheKey = () => `leaf-underside:${base.getHexString()}`;
  return material;
}
