import { test } from "node:test";
import assert from "node:assert/strict";
import { PlantProfile, PlantState, STAGES } from "./schema";
import { fixtures } from "./fixtures";
import { monthsToHeight, simulate } from "./simulation";

const at = (p: PlantProfile, m: number, water?: number) => PlantState.parse(simulate(p, m, water));

test("month 0 is the photographed plant", () => {
  for (const p of Object.values(fixtures)) {
    const s = at(p, 0);
    assert.equal(s.heightCm, p.observation.frame.plantHeightCm);
    assert.equal(s.canopyWidthCm, p.observation.frame.canopyWidthCm);
    assert.equal(s.leafCount, p.observation.leaves.count);
  }
});

test("healthy growth only moves forward and is deterministic", () => {
  for (const p of Object.values(fixtures)) {
    let last = at(p, 0);
    for (const m of [1, 3, 6, 12, 24, 48, 120]) {
      const s = at(p, m);
      assert.deepEqual(s, at(p, m));
      assert(s.heightCm >= last.heightCm - 1e-9 && s.leaves >= last.leaves - 1e-9 && s.stemThicknessMm >= last.stemThicknessMm - 1e-9, `${p.identity.scientificName} shrank at ${m} months`);
      assert(STAGES.indexOf(s.stage) >= STAGES.indexOf(last.stage));
      last = s;
    }
  }
});

test("growth changes morphology, species by species, not just size", () => {
  const monstera = [at(fixtures.monstera, 0), at(fixtures.monstera, 36)];
  assert(monstera[1].leafMaturity > monstera[0].leafMaturity && monstera[1].fenestration > monstera[0].fenestration, "Monstera leaves should mature and split more");
  const basil = [at(fixtures.basil, 0), at(fixtures.basil, 3)];
  assert(basil[1].axes > basil[0].axes && basil[1].leaves > basil[0].leaves * 1.5 && basil[1].branchingDensity > basil[0].branchingDensity, "basil should branch and bush out");
  const ficus = [at(fixtures.ficus, 0), at(fixtures.ficus, 48)];
  assert(ficus[1].branchingDensity > ficus[0].branchingDensity + 0.2 && ficus[1].stemThicknessMm > ficus[0].stemThicknessMm * 1.5, "Ficus should branch and turn woody");
  const cactus = [at(fixtures.cactus, 0), at(fixtures.cactus, 150)];
  assert(cactus[1].axes > cactus[0].axes && cactus[1].canopyWidthCm > cactus[0].canopyWidthCm, "the barrel should widen and offset");
  const cane = [at(fixtures.dracaena, 0), at(fixtures.dracaena, 30)];
  assert(cane[1].axes > cane[0].axes, "Dracaena should add a crown");
});

test("watering drives wilt, vitality and pace", () => {
  const p = fixtures.monstera, ideal = p.care.waterIntervalDays;
  const ok = at(p, 12, ideal), dry = at(p, 12, ideal * 4);
  assert(dry.wilt > 0.5 && dry.droop > ok.droop && dry.vitality < ok.vitality && dry.heightCm < ok.heightCm);
  assert.equal(monthsToHeight(p, p.observation.frame.plantHeightCm), 0);
  assert(monthsToHeight(p, 120, ideal * 6) === null || monthsToHeight(p, 120, ideal * 6)! > monthsToHeight(p, 120)!);
});
