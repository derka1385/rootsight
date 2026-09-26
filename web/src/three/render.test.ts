import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtures } from "@rootsight/shared/fixtures";
import { defaultConditions } from "@rootsight/shared/simulation";
import { labScans } from "./photoProfiles";
import { renderPlanOf } from "./renderPlan";
import { aroidLayout } from "./Aroid";
import { caneLayout } from "./Cane";
import { plantLayout } from "./architecture";
import { leafGeometry } from "./leafSystem";

const profiles = { ...fixtures, ...labScans };
const finite = (ms: { elements: number[] }[]) => ms.every((m) => m.elements.every(Number.isFinite));

/** Layout counts for a plan, via the renderer its species maps to. */
function layout(name: string, mode: "scanned" | "future", months: number) {
  const p = profiles[name as keyof typeof profiles];
  const plan = renderPlanOf(p, mode, months, defaultConditions(p));
  if (plan.archetype === "aroid") {
    const l = aroidLayout(plan, { count: plan.leafCount, wilt: plan.wilt, height: plan.heightM });
    assert(finite([...l.leaves.map((x) => x.matrix), ...l.petioles, ...l.stem, ...l.aerial]), `${name}: non-finite aroid layout`);
    return { plan, leaves: l.leaves.length, top: l.top, structure: l.stem.length + l.aerial.length };
  }
  if (plan.archetype === "cane") {
    const l = caneLayout(plan);
    assert(finite([...l.trunk, ...l.leaves]), `${name}: non-finite cane layout`);
    return { plan, leaves: l.leaves.length, top: plan.heightM, structure: l.trunk.length };
  }
  const l = plantLayout(plan.profile, plan.state, plan.visual);
  assert(finite([...l.stems, ...l.leaves.flat()]), `${name}: non-finite layout`);
  return { plan, leaves: l.leaves.flat().length, top: plan.heightM, structure: l.stems.length };
}

test("the Scanned render rebuilds the photographed plant", () => {
  for (const name of Object.keys(profiles)) {
    const p = profiles[name as keyof typeof profiles], l = layout(name, "scanned", 0);
    assert.equal(l.plan.archetype, p.prior.archetype, `${name}: renderer should follow the species prior`);
    if (l.plan.archetype === "aroid") {
      assert.equal(l.leaves, p.observation.leaves.count, `${name}: scanned leaf count`);
      assert(Math.abs(l.top - l.plan.heightM) / l.plan.heightM < 0.35, `${name}: rendered ${l.top.toFixed(2)} m vs ${l.plan.heightM.toFixed(2)} m`);
    }
    if (l.plan.archetype === "cane") assert(Math.abs(l.leaves - p.observation.leaves.count) <= p.observation.structure.axes.length * 2, `${name}: cane leaves`);
  }
});

test("the Future render changes structure, not only scale", () => {
  for (const name of Object.keys(profiles)) {
    const now = layout(name, "scanned", 0), later = layout(name, "future", 36);
    if (now.plan.archetype === "cactus") continue; // a barrel's change is its body and offsets (checked in simulation)
    assert(later.leaves > now.leaves || later.structure > now.structure, `${name}: future is a scaled copy (${now.leaves}/${now.structure} -> ${later.leaves}/${later.structure})`);
  }
});

test("leaf geometry is finite for every margin type", () => {
  for (const serration of [0, 1, 2]) {
    const g = leafGeometry({ widthToLength: 0.8, widest: 0.4, baseWidth: 0.7, lobe: 0.12, acumen: 0.4, asymmetry: 0.1, arch: 0.2, cup: 0.4, fold: 0.1, undulation: 0.01, twist: 0.05, serration, seed: "test" });
    assert(Array.from(g.attributes.position.array).every(Number.isFinite) && g.index!.count > 0);
  }
});
