import { PlantProfile } from "../schema";
import { fixtures } from "./index";

/** Hand-authored mock observation, not claimed to be an inference from an uploaded image. */
export const observedMonstera = PlantProfile.parse({
  ...fixtures.monstera,
  visual: { silhouette: { widthToHeight: 1.05, symmetry: 0.62 }, stems: { count: 3 }, leaves: { curl: 0.3, fenestration: 0.65 }, pot: { diameterToHeight: 0.4, color: "#c5b6a0", material: "ceramic" } },
  individual: {
    seed: "mock-observed-monstera", crownShape: "fan", crownDensity: 0.65, maturity: 0.72,
    estimatedBranchCount: 0, averageLeafAngleDeg: 108, leafAsymmetry: 0.16,
    stemTaper: 0.62, stemCurvature: 0.45, depthToWidth: 0.42,
    leaves: [
      { id: "leaf-0", x: -0.46, y: 0.6, layer: "foreground", size: 1, angleDeg: 112, azimuthDeg: -35, stemIndex: 0 },
      { id: "leaf-1", x: 0.25, y: 0.75, layer: "foreground", size: 0.95, angleDeg: 110, azimuthDeg: 32, stemIndex: 1 },
      { id: "leaf-2", x: -0.22, y: 0.86, layer: "background", size: 0.8, angleDeg: 85, azimuthDeg: -15, stemIndex: 0 },
      { id: "leaf-3", x: 0.58, y: 0.47, layer: "middle", size: 0.74, angleDeg: 123, azimuthDeg: 58, stemIndex: 2 },
      { id: "leaf-4", x: -0.62, y: 0.37, layer: "middle", size: 0.7, angleDeg: 125, azimuthDeg: -60, stemIndex: 0 },
      { id: "leaf-5", x: 0.05, y: 0.92, layer: "background", size: 0.45, angleDeg: 55, azimuthDeg: 24, stemIndex: 1 },
      { id: "leaf-6", x: 0.22, y: 0.28, layer: "foreground", size: 0.6, angleDeg: 132, azimuthDeg: 15, stemIndex: 2 },
    ],
  },
});
