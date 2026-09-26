/** Run: node --import tsx docs/fidelity/verify.ts */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlantProfile } from '../../shared/schema';
import { simulate } from '../../shared/simulation';
import { visualOf, type RenderProfile } from '../../web/src/three/visual';
import { plantLayout, architectureOf } from '../../web/src/three/architecture';
import { leafGeometry } from '../../web/src/three/leafSystem';
import { renderSpecOf, type GrowthStage } from '../../web/src/three/renderSpec';
import { aroidLayout } from '../../web/src/three/Aroid';
import { architectureProfiles } from '../../web/src/three/photoProfiles';

const profiles = ['monstera', 'basil', 'cactus'].map(name => PlantProfile.parse(JSON.parse(readFileSync(new URL(`../../shared/fixtures/${name}.json`, import.meta.url), 'utf8'))));
const matrices = (p: RenderProfile, month: number) => {
  const { visual: _, ...base } = p;
  return plantLayout(p, simulate(base, month, p.care.waterIntervalDays), visualOf(p));
};
for (const p of profiles) {
  const v = visualOf(p);
  assert.deepEqual(visualOf({ ...p, visual: undefined }), visualOf({ ...p, visual: null }), 'a profile without a visual block must render');
  assert.deepEqual(matrices(p, 0), matrices(p, 0), 'layout must be deterministic');
  const current = matrices(p, 0);
  assert.equal(current.leaves.flat().length, p.morphology.leaf.countNow);
  for (const month of [0, 0.01, 4, 24]) for (const matrix of [...matrices(p, month).stems, ...matrices(p, month).leaves.flat()]) {
    assert(matrix.elements.every(Number.isFinite));
  }
  const partial = visualOf({ ...p, visual: { stems: { count: 900, thicknessCm: NaN }, leaves: { curl: Infinity }, pot: { color: 'invalid' } } });
  assert.equal(partial.stems.count, 12);
  // Malformed fields fall back to the same defaults a profile without a visual block gets.
  const fallback = visualOf({ ...p, visual: undefined });
  assert.equal(partial.stems.thicknessCm, fallback.stems.thicknessCm);
  assert.equal(partial.leaves.curl, fallback.leaves.curl);
  assert.equal(partial.pot.color, fallback.pot.color);
  for (const serration of [0, 1, 2]) for (const lobe of [0, 0.12]) {
    const blade = leafGeometry({ widthToLength: v.leaves.widthToLength, widest: 0.35, baseWidth: 0.5, lobe, acumen: 0.4, asymmetry: 0.1, arch: 0.2, cup: 0.5, fold: 0.1, undulation: 0.01, twist: 0.05, serration, seed: 'verify' });
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
assert.equal(aliases.stems.count, 5); assert.equal(aliases.stems.thicknessCm, 0.7); assert.equal(aliases.cactus.form, 'pads'); assert.equal(aliases.pot.diameterToHeight, 15 / p.morphology.currentHeightCm); assert.equal(aliases.condition.legginess, 0.6);
for (const form of ['vine', 'grass', 'succulent', 'tree'] as const) {
  const q = { ...p, morphology: { ...p.morphology, growthForm: form } };
  assert.equal(architectureOf(q, visualOf(q)), form);
  assert(matrices(q, 0).leaves.flat().length > 0);
}
// Monstera: stages only move forward, leaves are only added, each leaf keeps its birth form/size,
// today's render shows exactly the photographed leaves, and every layout is finite.
const STAGES: GrowthStage[] = ['SEEDLING', 'JUVENILE', 'YOUNG', 'MATURE', 'LARGE_MATURE'];
for (const p of [profiles[0], architectureProfiles['monstera-seedling'] as RenderProfile]) {
  const { visual: _, ...base } = p;
  let last = { stage: -1, count: 0 };
  for (const month of [0, 0.5, 3, 6, 12, 24, 36, 60]) {
    const state = simulate(base, month, p.care.waterIntervalDays);
    const spec = renderSpecOf(p, state);
    assert(spec.monstera, `${p.species.scientificName} should use the Monstera archetype`);
    const stage = STAGES.indexOf(spec.stage);
    assert(stage >= last.stage && spec.leafCount >= last.count - 1e-9, `growth went backwards at month ${month}`);
    last = { stage, count: spec.leafCount };
    const layout = aroidLayout(spec, { count: spec.leafCount, wilt: spec.wilt, height: spec.heightM });
    for (const m of [...layout.leaves.map(l => l.matrix), ...layout.petioles, ...layout.stem, ...layout.aerial]) assert(m.elements.every(Number.isFinite), `non-finite layout at month ${month}`);
    if (month === 0) assert.equal(layout.leaves.length, p.morphology.leaf.countNow, 'today must show the photographed leaves');
    assert(Math.abs(layout.top - spec.heightM) / spec.heightM < 0.35, `rendered height ${layout.top.toFixed(2)} m vs simulated ${spec.heightM.toFixed(2)} m`);
    for (let i = p.morphology.leaf.countNow; i < spec.leafCount - 1; i++) {
      const a = spec.leafAt(i), b = spec.leafAt(i + 1);
      assert(b.form >= a.form - 1e-9 && b.lengthM >= a.lengthM - 1e-9, 'later leaves must be at least as mature');
    }
  }
  assert(last.stage >= 3, `${p.species.scientificName} never reached maturity`);
}
console.log('Passed: legacy profiles, malformed/partial fields, aliases, deterministic/finite layouts, geometry, leaf birth continuity, additional architectures, Monstera stages/heteroblasty.');
