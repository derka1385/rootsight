/** Run: node --import tsx docs/fidelity/verify.ts */
import assert from 'node:assert/strict';
import { PlantScan } from '../../shared/schema';
import { fixtures } from '../../shared/fixtures';
import { defaultConditions, growthAt, monthsToHeight } from '../../shared/simulation';
import { labScans } from '../../web/src/three/photoProfiles';
import { renderPlanOf } from '../../web/src/three/renderPlan';
import { aroidLayout } from '../../web/src/three/Aroid';
import { caneLayout } from '../../web/src/three/Cane';
import { plantLayout } from '../../web/src/three/architecture';
import { leafGeometry } from '../../web/src/three/leafSystem';

const scans = { ...fixtures, ...labScans };
const STAGES = ['SEEDLING', 'JUVENILE', 'YOUNG', 'MATURE', 'LARGE_MATURE'];
const finite = (ms: { elements: number[] }[]) => ms.every(m => m.elements.every(Number.isFinite));

for (const [name, scan] of Object.entries(scans)) {
  PlantScan.parse(scan);
  const o = scan.observation, c = defaultConditions(scan);

  // Month 0 IS the photographed plant.
  const today = growthAt(scan, 0, c);
  assert.equal(today.heightCm, o.frame.plantHeightCm, `${name}: month 0 height`);
  assert.equal(today.canopyWidthCm, o.frame.canopyWidthCm, `${name}: month 0 width`);
  assert.equal(today.leafCount, o.leaves.count, `${name}: month 0 leaves`);

  // Healthy growth only moves forward, and changes more than size.
  let last = today;
  for (const m of [3, 6, 12, 24, 48]) {
    const s = growthAt(scan, m, c);
    assert(s.heightCm >= last.heightCm - 1e-9 && s.leaves >= last.leaves - 1e-9 && STAGES.indexOf(s.stage) >= STAGES.indexOf(last.stage), `${name}: growth went backwards at ${m} months`);
    last = s;
  }
  if (o.archetype !== 'cactus') assert(last.maturity > today.maturity || last.axes > today.axes, `${name}: future is only a scaled copy`);

  // Conditions matter: drought wilts and slows, repotting a cramped plant never hurts.
  const dry = growthAt(scan, 12, { ...c, waterIntervalDays: c.waterIntervalDays * 4 });
  assert(dry.wilt > 0.3 && dry.vigor < growthAt(scan, 12, c).vigor, `${name}: drought has no effect`);
  assert(growthAt(scan, 12, { ...c, potDiameterCm: c.potDiameterCm * 1.5 }).heightCm >= growthAt(scan, 12, c).heightCm - 1e-9, `${name}: repotting slowed growth`);
  assert(monthsToHeight(scan, o.frame.plantHeightCm) === 0);

  // The Scanned render rebuilds the photographed counts and size; the Future render stays finite.
  for (const [mode, months] of [['scanned', 0], ['future', 24]] as const) {
    const plan = renderPlanOf(scan, mode, months, c);
    if (o.archetype === 'aroid') {
      const l = aroidLayout(plan, { count: plan.leafCount, wilt: plan.wilt, height: plan.heightM });
      assert(finite([...l.leaves.map(x => x.matrix), ...l.petioles, ...l.stem, ...l.aerial]), `${name}/${mode}: non-finite aroid layout`);
      if (mode === 'scanned') assert.equal(l.leaves.length, o.leaves.count, `${name}: scanned leaf count`);
      assert(Math.abs(l.top - plan.heightM) / plan.heightM < 0.35, `${name}/${mode}: rendered ${l.top.toFixed(2)} m vs ${plan.heightM.toFixed(2)} m`);
    } else if (o.archetype === 'cane') {
      const l = caneLayout(plan);
      assert(finite([...l.trunk, ...l.leaves]) && l.trunk.length > 0, `${name}/${mode}: cane layout`);
      if (mode === 'scanned') assert(Math.abs(l.leaves.length - o.leaves.count) <= o.structure.axes.length * 2, `${name}: scanned cane leaves ${l.leaves.length} vs ${o.leaves.count}`);
    } else {
      const l = plantLayout(plan.profile, plan.state, plan.visual);
      assert(finite([...l.stems, ...l.leaves.flat()]), `${name}/${mode}: non-finite layout`);
    }
  }
}

for (const serration of [0, 1, 2]) {
  const g = leafGeometry({ widthToLength: 0.8, widest: 0.4, baseWidth: 0.7, lobe: 0.12, acumen: 0.4, asymmetry: 0.1, arch: 0.2, cup: 0.4, fold: 0.1, undulation: 0.01, twist: 0.05, serration, seed: 'verify' });
  assert(Array.from(g.attributes.position.array).every(Number.isFinite) && g.index!.count > 0);
}
console.log(`Passed: ${Object.keys(scans).length} scans — month 0 = observation, forward-only growth that changes structure, conditions, scanned counts/sizes, finite layouts, leaf geometry.`);
