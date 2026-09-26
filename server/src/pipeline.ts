import type Anthropic from "@anthropic-ai/sdk";
import { PlantIdentification, RefinePatch, WhatIfAnswer, type GrowthConditions, type ImageInput, type PlantProfile, type RefineResult, type WhatIfResponse } from "@rootsight/shared/schema";
import { identifications } from "@rootsight/shared/fixtures";
import { buildPlantProfile } from "@rootsight/shared/knowledge";
import { simulate, vigorOf } from "@rootsight/shared/simulation";
import { askJson, imageBlock, useMock } from "./claude";
import { enrichSpeciesKnowledge } from "./knowledge/enrich";
import { IDENTIFY_PROMPT, REFINE_PROMPT, WHATIF_PROMPT } from "./prompts";

/*
 * The analysis pipeline:  photo -> identifyPlant -> enrichSpeciesKnowledge -> buildPlantProfile
 * and its two follow-ups:  refinePlant (photo vs render -> observation patch -> re-personalise)
 *                          simulateFuture (a scenario -> conditions -> simulate).
 * Mock mode swaps only the Claude calls; enrichment and personalisation run for real (library).
 */

const live = () => !useMock() && process.env.ENRICH_LIVE !== "false";

/** Claude reads the photo: species, visible traits, care card. Mock: a fixture identification. */
export async function identifyPlant(photo: ImageInput): Promise<PlantIdentification> {
  if (useMock()) return identifications.monstera;
  return askJson(PlantIdentification, IDENTIFY_PROMPT, [imageBlock(photo), { type: "text", text: "Identify and describe this plant." }], "medium");
}

export async function analyzePlant(photo: ImageInput): Promise<PlantProfile> {
  const t0 = Date.now();
  const id = await identifyPlant(photo);
  const { knowledge, via, ms } = await enrichSpeciesKnowledge(id, { live: live() });
  console.log(`[analyze] ${id.identity.scientificName} identified in ${Date.now() - t0 - ms} ms, knowledge via ${via} in ${ms} ms`);
  return buildPlantProfile(id, knowledge);
}

/** Paths of leaf values that differ, e.g. ["observation.leaves.count"]. */
export function changedPaths(a: unknown, b: unknown, path = ""): string[] {
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => changedPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [path];
}

/** Merge a refine patch into the observation: objects merge, arrays and scalars replace. */
export function applyPatch<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object" || Array.isArray(patch) || !base || typeof base !== "object") return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) out[k] = applyPatch(out[k], v);
  return out as T;
}

/**
 * Compare photo and render; Claude may only patch today's observation. The species card and prior stay,
 * and the growth stages are re-personalised deterministically from the patched observation.
 */
export async function refinePlant(photo: ImageInput, render: ImageInput, profile: PlantProfile): Promise<RefineResult> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: "Image 1, real photo:" }, imageBlock(photo),
    { type: "text", text: "Image 2, our render:" }, imageBlock(render),
    { type: "text", text: `Current PlantProfile:\n${JSON.stringify(profile)}` },
  ];
  const patch = useMock()
    ? RefinePatch.parse({ leaves: { density: Math.min(1, profile.observation.leaves.density + 0.1) }, corrections: ["(mock) canopy slightly fuller; set USE_MOCK=false for Claude's comparison"] })
    : await askJson(RefinePatch, REFINE_PROMPT, content, "medium");
  const { corrections, ...fields } = patch;
  const observation = applyPatch(profile.observation, fields);
  const id = PlantIdentification.parse({ ...profile, observation });
  const { knowledge } = await enrichSpeciesKnowledge(id, { live: live() });
  const next = buildPlantProfile(id, { ...knowledge, prior: profile.prior });
  return { profile: next, corrections, changed: changedPaths(profile.observation, next.observation).map((p) => `observation.${p}`) };
}

/** Mock scenarios: read a few patterns from the question. */
export function mockConditions(question: string, c: GrowthConditions): GrowthConditions {
  const q = question.toLowerCase(), next = { ...c };
  const every = q.match(/every\s+(\d+(?:\.\d+)?)?\s*(day|week|month)/);
  if (every) next.waterIntervalDays = Number(every[1] ?? 1) * { day: 1, week: 7, month: 30 }[every[2] as "day" | "week" | "month"];
  if (/dark|shade|less light|low light|corner/.test(q)) next.light = "low";
  else if (/full sun|direct sun|south/.test(q)) next.light = "full-sun";
  else if (/more light|bright|window/.test(q)) next.light = "bright-indirect";
  if (/repot|bigger pot|larger pot/.test(q)) next.potDiameterCm = Math.round(c.potDiameterCm * 1.4);
  if (/fertili[sz]|feed/.test(q)) next.pace = Math.min(3, c.pace * 1.25);
  return next;
}

/** A scenario becomes simulation conditions; the answer carries the simulated plant a year out. */
export async function simulateFuture(profile: PlantProfile, conditions: GrowthConditions, question: string): Promise<WhatIfResponse> {
  const answer = useMock()
    ? { conditions: mockConditions(question, conditions), explanation: "" }
    : await askJson(WhatIfAnswer, WHATIF_PROMPT, [{ type: "text", text: `PlantProfile:\n${JSON.stringify(profile)}\n\nCurrent conditions:\n${JSON.stringify(conditions)}\n\nQuestion: ${question}` }]);
  const c = answer.conditions;
  const inAYear = simulate(profile, 12, c.waterIntervalDays, c), baseline = simulate(profile, 12, conditions.waterIntervalDays, conditions);
  const explanation = answer.explanation || `(mock) In a year: ${Math.round(inAYear.heightCm)} cm and ${inAYear.leafCount} leaves at ${Math.round(inAYear.vitality * 100)}% vitality, vs ${Math.round(baseline.heightCm)} cm and ${baseline.leafCount} leaves as is (pace ×${vigorOf(profile, c).pace.toFixed(2)}).`;
  return { conditions: c, explanation, inAYear, baseline };
}
