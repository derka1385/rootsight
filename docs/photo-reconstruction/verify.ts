/** Run: node --import tsx docs/photo-reconstruction/verify.ts */
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PlantProfile } from '../../shared/schema';
import { fixtures } from '../../shared/fixtures';
import { simulate } from '../../shared/simulation';
import { visualOf } from '../../web/src/three/visual';
import { densityLeafFloor, foliageExtent, occupancyOf, plantLayout } from '../../web/src/three/architecture';
import { bloomLayout } from '../../web/src/three/bloomLayout';
import { corollaModel, corollaStyle, flowerInstances } from '../../web/src/three/Flowers';

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
    assert(o.base.distanceTo(o.position) <= o.length / 2 + 1e-9, `${name}: ${o.id} attaches outside its own body`);
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

// 1b. A measured trumpet stays a trumpet: one fused corolla per flower, as long as measured, joined at its base.
{
  const p = fixtures.brugmansia, v = visualOf(p), b = p.individual!.blooms!, shape = b.flowerShape!;
  assert(shape.tubeFraction >= 0.4 && shape.lengthCm > b.flowerDiameterCm, 'fixture is a long trumpet');
  const layout = bloomLayout(p, stateOf(p), v), flowers = layout.organs.filter(o => o.kind === 'flower');
  const parts = flowerInstances(layout.organs, v.botanical.flowering, { flower: b.flowerColor, center: b.centerColor, bud: b.budColor, fruit: b.fruitColor }, v.seed, 0, shape);
  assert.equal(parts.corollas.length, 1, 'a single brugmansia corolla');
  assert.equal(parts.corollas[0].length, b.flowers, 'every trumpet is one continuous corolla');
  assert.equal(parts.petals.length, 0, 'no loose petal fan for a fused corolla');
  for (const o of flowers) {
    assert(Math.abs(o.length - shape.lengthCm / 100) < shape.lengthCm / 100 * 0.12, `${o.id} keeps the measured length`);
    assert(Math.abs(o.base.distanceTo(o.position) - o.length / 2) < 1e-9, `${o.id} stalk joins the base of the tube`);
    assert(o.facing.y < -0.8, `${o.id} hangs as measured (axis ${shape.axisDeg} deg)`);
  }
}

// 1c. Datura 'Double Purple' (live scan): nested corollas, curling lobe tails, furled buds, spiny capsules.
{
  const base = fixtures.datura, b0 = base.individual!.blooms!, shape = b0.flowerShape!;
  assert(shape.layers === 3 && shape.tipTail! > 0.5 && shape.ribs! > 0.5 && b0.fruitSurface === 'spiny', 'the scan reads the triple, tailed, pleated corolla and spiny fruit');
  const withFruit = (fruitSurface: 'spiny' | 'smooth') => PlantProfile.parse({ ...base, individual: { ...base.individual, blooms: { ...b0, fruits: 3, fruitSurface } } });
  const p = withFruit('spiny'), v = visualOf(p), b = p.individual!.blooms!;
  const layout = bloomLayout(p, stateOf(p), v);
  const colors = { flower: b.flowerColor, center: b.centerColor, bud: b.budColor, fruit: b.fruitColor };
  const parts = flowerInstances(layout.organs, v.botanical.flowering, colors, v.seed, 0, shape, b.fruitSurface);
  assert.equal(parts.corollas.length, 3, 'one corolla per nested layer');
  assert(parts.corollas.every(layer => layer.length === b.flowers), 'every flower has every layer');
  assert.equal(parts.tails.length, b.flowers * 3 * shape.lobes, 'a tail on every lobe of every layer');
  assert.equal(parts.furled.length, b.buds, 'buds of a fused flower are furled spindles');
  assert.equal(parts.buds.length, 0);
  assert.equal(parts.fruits.length, 3);
  assert(parts.spines.length >= 3 * 40, 'spiny capsules carry spines');
  const smooth = withFruit('smooth');
  assert.equal(flowerInstances(bloomLayout(smooth, stateOf(smooth), visualOf(smooth)).organs, v.botanical.flowering, colors, v.seed, 0, shape, 'smooth').spines.length, 0, 'smooth fruit, no spines');
  // A nested corolla stays inside the tube around it (turned half a lobe, its ridges face the outer folds).
  const style = corollaStyle(shape, v.botanical.flowering.form);
  const layers = [0, 1, 2].map(k => corollaModel(shape, b.flowerDiameterCm, style, k));
  const radius = (k: number, angle: number, z: number) => { const q = layers[k].point(angle - layers[k].turn, z / (1 + 0.15 * k)); return Math.hypot(q.x, q.y); };
  for (let z = 0.01; z < shape.tubeFraction; z += 0.03) for (const k of [1, 2]) for (let i = 0; i < 240; i++) {
    const angle = i / 240 * Math.PI * 2;
    assert(radius(k, angle, z) < radius(k - 1, angle, z), `layer ${k} pokes through layer ${k - 1} at z=${z.toFixed(2)}, angle ${angle.toFixed(2)}`);
  }
}

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
console.log('Passed: measured trumpets rendered as one fused corolla of the measured length, nested datura corollas with lobe tails, furled buds and spiny capsules, every flower/bud/fruit attached to a stalk, drawn exactly as counted and never invented, species petal counts, deterministic blooms, density floor, silhouette-bound fill leaves, growth continuity.');

