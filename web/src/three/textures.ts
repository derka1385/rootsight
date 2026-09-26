import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Procedural textures drawn on canvases at startup: no image files, no network.
 * Most are near-white "detail maps" that get multiplied by a material colour.
 */
const cache = new Map<string, Texture>();

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = 1): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

// Tiny deterministic noise so textures look the same on every load.
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], maxR: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    g.globalAlpha = 0.25 + r() * 0.5;
    g.beginPath();
    g.arc(r() * w, r() * h, r() * maxR + 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Leaf blade: u across (0 margin, 0.5 midrib, 1 margin), v from base (0) to tip (1). Pale veins, darker margins. */
export const leafTexture = () =>
  make("leaf", 256, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#b9b9b9");
    grad.addColorStop(0.5, "#e8e8e8");
    grad.addColorStop(1, "#b9b9b9");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, ["#d0d0d0", "#f2f2f2"], 1.6, 7);
    g.strokeStyle = "#ffffff";
    g.lineCap = "round";
    // Midrib, thick at the base.
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w / 2, h);
    g.stroke();
    // Lateral veins sweeping towards the tip.
    g.globalAlpha = 0.75;
    for (let i = 1; i < 11; i++) {
      const y = (i / 11) * h * 0.95;
      g.lineWidth = 3.2 - i * 0.2;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(w / 2, y);
        g.quadraticCurveTo(w / 2 + side * w * 0.22, y + h * 0.04, w / 2 + side * w * 0.47, y + h * 0.12);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  });

/** Unglazed terracotta: speckles plus faint throwing rings. */
export const terracottaTexture = () =>
  make("terracotta", 512, 512, (g, w, h) => {
    g.fillStyle = "#f0f0f0";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, ["#d9d9d9", "#ffffff", "#c9c9c9"], 1.4, 11);
    const r = rng(3);
    g.globalAlpha = 0.18;
    for (let y = 0; y < h; y += 3 + r() * 5) {
      g.fillStyle = r() > 0.5 ? "#ffffff" : "#bdbdbd";
      g.fillRect(0, y, w, 1 + r() * 1.5);
    }
    g.globalAlpha = 1;
  }, 2);

/** Potting soil: dark crumbs, bark bits and perlite dots. */
export const soilTexture = () =>
  make("soil", 512, 512, (g, w, h) => {
    g.fillStyle = "#3a2a1e";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 7000, ["#2a1d14", "#4a3524", "#57402c", "#241910"], 2.6, 5);
    speckle(g, w, h, 180, ["#e9e4da", "#d8d2c6"], 1.8, 9); // perlite
    speckle(g, w, h, 120, ["#6b4a2e", "#7a5534"], 4, 13); // bark
  }, 3);

/** Light oak table top, grain running along x. */
export const woodTexture = () =>
  make("wood", 1024, 512, (g, w, h) => {
    g.fillStyle = "#d8bfa0";
    g.fillRect(0, 0, w, h);
    const r = rng(21);
    for (let i = 0; i < 260; i++) {
      const y = r() * h;
      g.strokeStyle = r() > 0.5 ? "rgba(120,82,48,0.12)" : "rgba(235,208,170,0.16)";
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * (2 + r() * 5));
      g.stroke();
    }
    g.strokeStyle = "rgba(90,60,35,0.35)"; // plank seams
    g.lineWidth = 2;
    for (let y = 0; y <= h; y += h / 4) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  }, 2);

/** Coir/moss pole: warm brown with short tangled fibres. */
export const coirTexture = () =>
  make("coir", 256, 512, (g, w, h) => {
    g.fillStyle = "#6a5037";
    g.fillRect(0, 0, w, h);
    const r = rng(17);
    g.lineCap = "round";
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI * 2, l = 3 + r() * 14;
      g.strokeStyle = r() > 0.55 ? "#8d6c49" : r() > 0.5 ? "#3f2d1d" : "#a88660";
      g.globalAlpha = 0.35 + r() * 0.5;
      g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
  });
