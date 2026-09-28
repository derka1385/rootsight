import type { WebGLProgramParametersWithUniforms } from "three";

/**
 * Thin-tissue lighting for leaves and petals, a cheap stand-in for transmission: light wraps a little
 * past the terminator and a blade lit from behind glows instead of going black. Works on
 * MeshStandardMaterial / MeshPhysicalMaterial (patches the physical direct-light term).
 */
export function thinTissue(shader: WebGLProgramParametersWithUniforms, back = 0.55, wrap = 0.45) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "vec3 irradiance = dotNL * directLight.color;",
    `float wrapNL = saturate( ( dot( geometryNormal, directLight.direction ) + ${wrap.toFixed(3)} ) / ${(1 + wrap).toFixed(3)} );
     float backNL = saturate( -dot( geometryNormal, directLight.direction ) );
     vec3 irradiance = ( mix( dotNL, wrapNL, 0.5 ) + backNL * ${back.toFixed(3)} ) * directLight.color;`,
  );
}
