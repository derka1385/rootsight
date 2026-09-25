/** Run: node --import tsx docs/fidelity/verify.ts */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlantProfile } from '../../shared/schema';
import { simulate } from '../../shared/simulation';
import { visualOf, type RenderProfile } from '../../web/src/three/visual';
import { plantLayout, architectureOf } from '../../web/src/three/architecture';
import { leafBlade } from '../../web/src/three/leafBlade';

const profiles = ['monstera', 'basil', 'cactus'].map(name => PlantProfile.parse(JSON.parse(readFileSync(new URL(`../../shared/fixtures/${name}.json`, import.meta.url), 'utf8'))));
const matrices = (p: RenderProfile, month: number) => {
  const { visual: _, ...base } = p;
  return plantLayout(p, simulate(base, month, p.care.waterIntervalDays), visualOf(p));
};
for (const p of profiles) {
  const v = visualOf(p);
  assert.deepEqual(v, visualOf({ ...p, visual: null }));
  assert.deepEqual(matrices(p, 0), matrices(p, 0), 'layout must be deterministic');
  const current = matrices(p, 0);
  assert.equal(current.leaves.flat().length, p.morphology.leaf.countNow);
  for (const month of [0, 0.01, 4, 24]) for (const matrix of [...matrices(p, month).stems, ...matrices(p, month).leaves.flat()]) {
    assert(matrix.elements.every(Number.isFinite));
  }
  const partial = visualOf({ ...p, visual: { stems: { count: 900, thicknessCm: NaN }, leaves: { curl: Infinity }, pot: { color: 'invalid' } } });
  assert.equal(partial.stems.count, 12);
  assert.equal(partial.stems.thicknessCm, v.stems.thicknessCm);
  assert.equal(partial.leaves.curl, v.leaves.curl);
  assert.equal(partial.pot.color, v.pot.color);
  for (const fenestration of [0, 0.13, 0.5, 1]) for (const edge of ['smooth', 'serrated', 'lobed'] as const) {
    const blade = leafBlade({ ...v.leaves, fenestration, edge });
    assert(Array.from(blade.attributes.position.array).every(Number.isFinite));
    assert(Array.from(blade.attributes.normal.array).every(Number.isFinite));
    assert(blade.index!.count > 0);
    blade.dispose();
  }
}
// Growth crosses a rounded leaf-count boundary without relocating existing leaves.
const p = profiles[1], v = visualOf(p), state = simulate(p, 0, p.care.waterIntervalDays);
const boundary = p.morphology.currentHeightCm * 15 / 14;
const a = plantLayout(p, { ...state, heightCm: boundary - 0.00001 }, v);
const b = plantLayout(p, { ...state, heightCm: boundary + 0.00001 }, v);
for (let group = 0; group < 4; group++) for (let i = 0; i < a.leaves[group].length; i++) {
  assert(a.leaves[group][i].elements.every((n, k) => Math.abs(n - b.leaves[group][i].elements[k]) < 0.0001), 'existing blades must stay continuous across birth');
}
const aliases = visualOf({ ...p, visual: { stems: { countFromSoil: 5, thicknessMm: 7 }, leaves: { colorUnder: '#aa9988', variegation: 'patches' }, succulent: { bodyForm: 'pads', ribCount: 8 }, pot: { diameterCm: 15 }, silhouette: { leanDirection: 'left', legginess: 0.6 } } });
assert.equal(aliases.stems.count, 5); assert.equal(aliases.stems.thicknessCm, 0.7); assert.equal(aliases.cactus.form, 'pads'); assert.equal(aliases.pot.diameterToHeight, 1); assert.equal(aliases.condition.legginess, 0.6);
for (const form of ['vine', 'grass', 'succulent', 'tree'] as const) {
  const q = { ...p, morphology: { ...p.morphology, growthForm: form } };
  assert.equal(architectureOf(q, visualOf(q)), form);
  assert(matrices(q, 0).leaves.flat().length > 0);
}
console.log('Passed: legacy profiles, malformed/partial fields, aliases, deterministic/finite layouts, geometry, leaf birth continuity, additional architectures.');
