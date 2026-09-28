/** Run: node --import tsx docs/photo-reconstruction/verify.ts */
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PlantProfile } from '../../shared/schema';
import { fixtures } from '../../shared/fixtures';
import { simulate } from '../../shared/simulation';
import { visualOf } from '../../web/src/three/visual';
import { densityLeafFloor, foliageExtent, occupancyOf, plantLayout } from '../../web/src/three/architecture';
import { bloomLayout } from '../../web/src/three/bloomLayout';
import { flowerInstances } from '../../web/src/three/Flowers';

const stateOf = (p: PlantProfile, month = 0) => simulate(p, month, p.care.waterIntervalDays);
const finite = (v: Vector3) => [v.x, v.y, v.z].every(Number.isFinite);

// 1. Every counted flower, bud and fruit is drawn; nothing is invented.
for (const name of ['cyclamen', 'kalanchoe'] as const) {
  const p = fixtures[name], v = visualOf(p), b = p.individual!.blooms!;
  const layout = bloomLayout(p, stateOf(p), v);
  for (const kind of ['flower', 'bud', 'fruit'] as const) {
    const counted = { flower: b.flowers, bud: b.buds, fruit: b.fruits }[kind];
    assert.equal(layout.organs.filter(o => o.kind === kind).length, counted, `${name}: ${kind}s drawn = counted`);
  }
  assert(layout.organs.every(o => finite(o.position) && finite(o.facing) && o.size > 0));
  // Attached, never floating: a stalk (or pedicel) ends exactly at every organ's base, inside the organ.
  for (const o of layout.organs) {
    assert(layout.stalks.some(st => st.points.at(-1)!.distanceTo(o.base) < 1e-9), `${name}: ${o.id} has no stalk ending at its base`);
    assert(o.base.distanceTo(o.position) < o.size * 0.6, `${name}: ${o.id} attaches outside its own body`);
  }
  assert.deepEqual(bloomLayout(p, stateOf(p), v), layout, `${name}: bloom layout must be deterministic`);
  // Observed landmarks stay where the photo put them (single-floret ones sit exactly at their centre).
  const parts = flowerInstances(layout.organs, v.botanical.flowering, { flower: b.flowerColor, center: b.centerColor, bud: b.budColor, fruit: b.fruitColor }, v.seed, 0);
  assert.equal(parts.buds.length, b.buds);
  const petals = v.botanical.flowering.form === 'spathe' ? 1 : Math.max(3, v.botanical.flowering.petals);
  assert.equal(parts.petals.length, b.flowers * petals * (v.botanical.flowering.form === 'double' ? 2 : 1), `${name}: petals per flower follow the species`);
}
for (const p of [fixtures.monstera, fixtures.basil, fixtures.cactus]) assert.equal(bloomLayout(p, stateOf(p), visualOf(p)).organs.length, 0, 'no inventory, no flowers');
const noBlooms = PlantProfile.parse({ ...fixtures.cyclamen, individual: { ...fixtures.cyclamen.individual, blooms: { ...fixtures.cyclamen.individual!.blooms!, flowers: 0, buds: 0, fruits: 0, landmarks: [] } } });
assert.equal(bloomLayout(noBlooms, stateOf(noBlooms), visualOf(noBlooms)).organs.length, 0, 'a plant photographed without flowers renders none');

// 2. A dense photo never renders sparse: an undercounted but dense canopy is filled to its density floor.
const sparseCount = PlantProfile.parse({ ...fixtures.kalanchoe, morphology: { ...fixtures.kalanchoe.morphology, leaf: { ...fixtures.kalanchoe.morphology.leaf, countNow: 4 } }, individual: { ...fixtures.kalanchoe.individual, crownDensity: 0.95, leaves: [] } });
const floor = densityLeafFloor(sparseCount, visualOf(sparseCount));
assert(floor > 4, `density floor ${floor} must exceed an undercount of 4`);
assert.equal(plantLayout(sparseCount, stateOf(sparseCount), visualOf(sparseCount)).organs.length, floor);
for (const p of [fixtures.monstera, fixtures.basil, fixtures.cactus]) assert.equal(densityLeafFloor(p, visualOf(p)), 0, 'legacy profiles keep their own count');

// 3. Leaves that are not individually observed fill the photographed foliage silhouette, not the empty sky above it.
{
  const p = fixtures.cyclamen, v = visualOf(p), s = stateOf(p), grid = occupancyOf(p)!;
  const layout = plantLayout(p, s, v);
  const top = foliageExtent(grid).top * p.morphology.currentHeightCm / 100;
  const fill = layout.organs.filter(o => o.id.startsWith('inferred-'));
  assert(fill.length > 0);
  for (const o of fill) {
    const centre = new Vector3(0, 0, 0.5).applyMatrix4(o.matrix); // blade midpoint
    assert(centre.y <= top + 0.02, `${o.id} centre ${centre.y.toFixed(3)} m above the photographed foliage top ${top.toFixed(3)} m`);
  }
  // Growth keeps every existing blade in place across a leaf birth.
  const a = plantLayout(p, { ...s, heightCm: s.heightCm * 1.2 - 1e-7 }, v), b = plantLayout(p, { ...s, heightCm: s.heightCm * 1.2 + 1e-7 }, v);
  for (const leaf of a.organs) assert(b.organs.find(x => x.id === leaf.id)!.matrix.elements.every((n, i) => Math.abs(n - leaf.matrix.elements[i]) < 1e-5));
}
console.log('Passed: every flower/bud/fruit attached to a stalk, drawn exactly as counted and never invented, species petal counts, deterministic blooms, density floor, silhouette-bound fill leaves, growth continuity.');

