import type { MeshStandardMaterial } from "three";

/** Shared by visible and shadow passes so a young blade casts its actual silhouette. */
export function deformLeaf(shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0]) {
  shader.vertexShader = "attribute vec3 juvenilePosition; attribute vec3 juvenileNormal; attribute float instanceMaturity; attribute float leafSide; varying float bladeSide;\n" + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = mix(juvenilePosition, position, instanceMaturity); bladeSide = leafSide;");
  shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = normalize(mix(juvenileNormal, normal, instanceMaturity));");
}
