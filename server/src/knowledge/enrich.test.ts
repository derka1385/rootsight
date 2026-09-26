import { test } from "node:test";
import assert from "node:assert/strict";
import { PlantIdentification, type SpeciesKnowledge } from "@rootsight/shared/schema";
import { identifications } from "@rootsight/shared/fixtures";
import { librarySpecies } from "@rootsight/shared/species";
import { enrichSpeciesKnowledge } from "./enrich";
import { forgetAll, slug } from "./cache";
import type { SpeciesKnowledgeProvider } from "./providers";

const unknown = (name: string) => PlantIdentification.parse({ ...identifications.monstera, identity: { ...identifications.monstera.identity, scientificName: name, aliases: [] } });

test("curated species come from the library without touching the network", async () => {
  const r = await enrichSpeciesKnowledge(identifications.basil, { live: true, providers: [{ name: "boom", references: () => { throw new Error("must not be called"); } }] });
  assert.equal(r.via, "library");
  assert.equal(r.knowledge.scientificName, "Ocimum basilicum");
});

test("live references are normalised once, then served from the cache", async () => {
  forgetAll();
  const name = `Philodendron testii ${Date.now()}`;
  let calls = 0;
  const provider: SpeciesKnowledgeProvider = { name: "fake-wiki", references: async () => ({ text: [{ title: name, body: "A climbing aroid with split leaves.", source: { provider: "wikipedia", title: name } }] }) };
  const normalizer = { normalize: async (): Promise<SpeciesKnowledge> => { calls++; return { ...librarySpecies("Monstera deliciosa")!, scientificName: name, sources: [{ provider: "claude", title: "fake" }] }; } };
  const first = await enrichSpeciesKnowledge(unknown(name), { live: true, providers: [provider], normalizer });
  const second = await enrichSpeciesKnowledge(unknown(name), { live: true, providers: [provider], normalizer });
  assert.equal(first.via, "live");
  assert.equal(second.via, "cache");
  assert.equal(calls, 1);
  const { rm } = await import("node:fs/promises");
  await rm(new URL(`../../.cache/species/${slug(name)}.json`, import.meta.url), { force: true });
});

test("failing references or mock mode fall back to a generic prior", async () => {
  const failing: SpeciesKnowledgeProvider = { name: "down", references: async () => { throw new Error("offline"); } };
  const r = await enrichSpeciesKnowledge(unknown("Nonexistentia fakea"), { live: true, providers: [failing] });
  assert.equal(r.via, "generic");
  const off = await enrichSpeciesKnowledge(unknown("Nonexistentia fakea"), { live: false });
  assert.equal(off.via, "generic");
});
