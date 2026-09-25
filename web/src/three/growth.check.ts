import assert from "node:assert";
import { Vector3 } from "three";
import { plantLayout } from "./architecture";
import { visualOf } from "./visual";
import { fixtures } from "@rootsight/shared/fixtures";

for (const name of ["basil", "monstera"] as const) {
  const p = (fixtures as any)[name];
  const v = visualOf(p);
  const at = (h: number) => {
    const l = plantLayout(p, { heightCm: h, wilt: 0, rootDepthCm: 10, rootSpreadCm: 10 } as any, v);
    const sizes = l.leaves.flat().map(m => new Vector3().setFromMatrixScale(m).x);
    assert(l.stems.every(m => m.elements.every(Number.isFinite)), `${name}@${h}: NaN in stems`);
    assert(sizes.every(Number.isFinite), `${name}@${h}: NaN in leaf size`);
    return { segs: l.stems.length, leaves: sizes.length, spread: Math.max(...sizes) / Math.min(...sizes) };
  };
  const now = at(p.morphology.currentHeightCm), later = at(p.morphology.currentHeightCm * 2.5);
  console.log(name, "now", now, "later", later);
  assert(later.leaves > now.leaves, `${name}: growth added no leaves`);
  assert(later.segs > now.segs, `${name}: growth added no stem segments`);
  assert(later.spread > 1.4, `${name}: future leaves are all the same size (${later.spread.toFixed(2)}x)`);
}
console.log("growth check OK");

// A photo-derived profile that undercounts leaves must still render a leafy plant, not bare sticks.
{
  const rose = JSON.parse(JSON.stringify(fixtures.basil));
  rose.morphology = { ...rose.morphology, growthForm: "upright-branching", currentHeightCm: 45, leaf: { shape: "ovate", color: "#2f6b33", lengthCm: 6, countNow: 4 } };
  rose.visual.stems.countFromSoil = 4;
  rose.visual.leaves.arrangement = "alternate";
  const l = plantLayout(rose, { heightCm: 45, wilt: 0, rootDepthCm: 10, rootSpreadCm: 10 } as any, visualOf(rose));
  const leaves = l.leaves.flat().length;
  console.log("undercounted rose ->", leaves, "leaves,", l.stems.length, "segments");
  assert(leaves >= 24, `a 4-stem shrub rendered only ${leaves} leaves (bare sticks)`);
}
console.log("density check OK");
