/** Run: node --import tsx docs/individual-morphology/verify.ts */
import assert from 'node:assert/strict';
import { PlantProfile, VisionPlantProfile } from '../../shared/schema';
import { observedMonstera } from '../../shared/fixtures/observed';
import { simulate } from '../../shared/simulation';
import { visualOf } from '../../web/src/three/visual';
import { plantLayout } from '../../web/src/three/architecture';
import { leafBlade } from '../../web/src/three/leafBlade';
import { stemGeometry } from '../../web/src/three/StemGeometry';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
const p = PlantProfile.parse(observedMonstera), state = simulate(p, 0, p.care.waterIntervalDays);
const layout = (q = p, heightCm = state.heightCm) => plantLayout(q, { ...state, heightCm }, visualOf(q));
assert.deepEqual(PlantProfile.parse(JSON.parse(JSON.stringify(p))), p);
assert(zodOutputFormat(VisionPlantProfile));
assert(!PlantProfile.safeParse({ ...p, individual: { leaves: [{ ...p.individual!.leaves![0], x: 2 }] } }).success);
assert(!PlantProfile.safeParse({ ...p, individual: { leaves: [p.individual!.leaves![0], p.individual!.leaves![0]] } }).success);
assert.deepEqual(layout(), layout({ ...p, individual: { ...p.individual, leaves: [...p.individual!.leaves!].reverse() } }), 'observation order must not change geometry');
const moved = layout({ ...p, individual: { ...p.individual, leaves: p.individual!.leaves!.map((leaf, i) => i === 0 ? { ...leaf, x: leaf.x + 0.1 } : leaf) } });
const original = layout();
assert.notDeepEqual(original.organs[0].matrix, moved.organs[0].matrix);
for (let i = 1; i < original.organs.length; i++) assert.deepEqual(original.organs[i].matrix, moved.organs[i].matrix);
const grown = layout(p, state.heightCm * 2);
assert(grown.organs.length > original.organs.length);
for (const leaf of original.organs) {
  const next = grown.organs.find(x => x.id === leaf.id)!;
  assert(next && next.parentId === leaf.parentId && next.maturity >= leaf.maturity);
}
for (const ratio of [1, 8 / 7, 1.5, 2, 4]) {
  const before = layout(p, state.heightCm * ratio - 1e-7);
  const after = layout(p, state.heightCm * ratio + 1e-7);
  for (const leaf of before.organs) {
    const next = after.organs.find(x => x.id === leaf.id)!;
    assert(next.matrix.elements.every((value, i) => Math.abs(value - leaf.matrix.elements[i]) < 1e-5));
  }
}
for (const fenestration of [0, 0.5, 1]) {
  const geometry = leafBlade({ ...visualOf(p).leaves, fenestration });
  for (const key of ['position', 'normal', 'juvenilePosition', 'juvenileNormal']) {
    assert.equal(geometry.getAttribute(key).count, geometry.getAttribute('position').count);
    assert(Array.from(geometry.getAttribute(key).array).every(Number.isFinite));
  }
  const edges = new Map<string, number>();
  const indices = geometry.index!.array;
  for (let i = 0; i < indices.length; i += 3) for (const [a, b] of [[indices[i], indices[i + 1]], [indices[i + 1], indices[i + 2]], [indices[i + 2], indices[i]]]) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  assert([...edges.values()].every(count => count === 2), 'solid leaf must have no open boundary');
  geometry.dispose();
}
const stems = stemGeometry(grown.stemPaths);
assert(Array.from(stems.attributes.position.array).every(Number.isFinite));
assert(stems.index!.count > 0); stems.dispose();
const image = { imageBase64: 'test', mediaType: 'image/png' };
const analyze = await fetch('http://localhost:8790/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(image) });
assert.equal(analyze.status, 200);
const scanned = PlantProfile.parse(await analyze.json());
const refine = await fetch('http://localhost:8790/api/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo: image, renderScreenshot: image, profile: scanned }) });
assert.equal(refine.status, 200);
assert.deepEqual(PlantProfile.parse(await refine.json()).individual, scanned.individual);
console.log('Passed: schema roundtrip and rejection, structured output, ID/order stability, local leaf edits, continuous growth, closed leaf shells, finite stems, mock analyze/refine preservation.');
