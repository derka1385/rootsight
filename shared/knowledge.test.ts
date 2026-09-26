import { test } from "node:test";
import assert from "node:assert/strict";
import { PlantIdentification, PlantProfile, SpeciesKnowledge } from "./schema";
import { identifications } from "./fixtures";
import { buildPlantProfile, genericKnowledge, personalizeStages } from "./knowledge";
import { librarySpecies, SPECIES_LIBRARY } from "./species/library";

test("the curated library is valid and finds species by name, synonym and alias", () => {
  for (const k of SPECIES_LIBRARY) SpeciesKnowledge.parse(k);
  assert.equal(librarySpecies("Monstera deliciosa 'Thai Constellation'")?.scientificName, "Monstera deliciosa");
  assert.equal(librarySpecies("Sansevieria trifasciata")?.scientificName, "Dracaena trifasciata");
  assert.equal(librarySpecies("Unknown plant", ["Epipremnum aureum"])?.scientificName, "Epipremnum aureum");
  assert.equal(librarySpecies("Philodendron hederaceum"), null);
});

test("personalised stages start at the photo and only grow", () => {
  for (const id of Object.values(identifications)) {
    const k = librarySpecies(id.identity.scientificName)!;
    const stages = personalizeStages(id.observation, k);
    assert.equal(stages[0].heightCm, id.observation.frame.plantHeightCm);
    assert.equal(stages[0].source, "observation");
    for (let i = 1; i < stages.length; i++) {
      assert(stages[i].monthsFromNow > stages[i - 1].monthsFromNow, `${id.identity.scientificName}: stage ${i} not later`);
      assert(stages[i].heightCm >= stages[i - 1].heightCm && stages[i].leafMaturity >= stages[i - 1].leafMaturity);
    }
  }
});

test("an unknown species falls back to a generic prior of the observed archetype", () => {
  const id = PlantIdentification.parse({ ...identifications.basil, identity: { ...identifications.basil.identity, scientificName: "Plectranthus scutellarioides", commonName: "Coleus", aliases: [] } });
  const k = genericKnowledge(id);
  assert.equal(k.prior.archetype, "herb");
  assert.equal(k.sources[0].provider, "generic");
  const profile = PlantProfile.parse(buildPlantProfile(id, k));
  assert(profile.stages.length >= 2 && profile.stages.at(-1)!.leafCount > id.observation.leaves.count);
});

test("an already mature plant still gets a future stage", () => {
  const id = PlantIdentification.parse({ ...identifications.monstera, observation: { ...identifications.monstera.observation, frame: { ...identifications.monstera.observation.frame, plantHeightCm: 260 } } });
  const stages = personalizeStages(id.observation, librarySpecies("Monstera deliciosa")!);
  assert(stages.length >= 2 && stages[1].monthsFromNow > 0);
});

test("repeated ages in normalised references give one stage each", () => {
  const k = librarySpecies("Monstera deliciosa")!;
  const dup = { ...k, stages: [...k.stages, { ...k.stages.at(-1)!, stage: "MATURE" as const }] };
  const stages = personalizeStages(identifications.monstera.observation, dup);
  const months = stages.map((s) => s.monthsFromNow);
  assert.equal(new Set(months).size, months.length);
});
