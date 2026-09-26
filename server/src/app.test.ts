import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { PlantProfile, RefineResult, WhatIfResponse } from "@rootsight/shared/schema";
import { defaultConditions } from "@rootsight/shared/simulation";
import { createApp } from "./app";

// Mock mode: no key, no network; the pipeline still runs enrichment (library) and personalisation.
process.env.USE_MOCK = "true";
let server: Server, base = "";
before(() => new Promise<void>((done) => { server = createApp().listen(0, () => { base = `http://localhost:${(server.address() as AddressInfo).port}/api`; done(); }); }));
after(() => new Promise<void>((done) => server.close(() => done())));

const post = async (path: string, body: unknown) => {
  const res = await fetch(`${base}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
};
const photo = { imageBase64: "eA==", mediaType: "image/jpeg" };

test("analyze returns a validated, species-informed profile", async () => {
  const { status, json } = await post("analyze", photo);
  assert.equal(status, 200);
  const p = PlantProfile.parse(json);
  assert.equal(p.prior.archetype, "aroid");
  assert(p.sources.some((s) => s.provider === "library"));
  assert(p.stages.length >= 3 && p.stages[0].source === "observation");
});

test("refine patches today's plant and reports what changed", async () => {
  const profile = PlantProfile.parse((await post("analyze", photo)).json);
  const { status, json } = await post("refine", { photo, renderScreenshot: photo, profile });
  assert.equal(status, 200);
  const r = RefineResult.parse(json);
  assert.deepEqual(r.changed, ["observation.leaves.density"]);
  assert.deepEqual(r.profile.prior, profile.prior);
});

test("what-if turns a question into conditions and a simulated plant", async () => {
  const profile = PlantProfile.parse((await post("analyze", photo)).json);
  const { json } = await post("whatif", { profile, conditions: defaultConditions(profile), question: "What if I water every 4 weeks?" });
  const r = WhatIfResponse.parse(json);
  assert.equal(r.conditions.waterIntervalDays, 28);
  assert(r.inAYear.wilt > r.baseline.wilt && r.inAYear.vitality < r.baseline.vitality);
});

test("bad requests are 400, not 500", async () => {
  assert.equal((await post("analyze", { nope: true })).status, 400);
});
