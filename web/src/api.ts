import type { z } from "zod";
import { PlantProfile, RefineResult, WhatIfResponse, type GrowthConditions, type ImageInput } from "@rootsight/shared/schema";

async function post<S extends z.ZodType>(path: string, body: unknown, schema: S): Promise<z.infer<S>> {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error([json.error, json.details].filter(Boolean).join(": "));
  return schema.parse(json);
}

/** Photo -> identity + what the photo shows + species prior + personalised growth stages. */
export const analyze = (photo: ImageInput) => post("analyze", photo, PlantProfile);

/** Photo + our render -> a profile whose observation (today's plant) is closer to the photo. */
export const refine = (photo: ImageInput, renderScreenshot: ImageInput, profile: PlantProfile) =>
  post("refine", { photo, renderScreenshot, profile }, RefineResult);

/** A scenario re-plans the future (conditions, growth path), never today's plant. */
export const whatIf = (profile: PlantProfile, conditions: GrowthConditions, question: string) =>
  post("whatif", { profile, conditions, question }, WhatIfResponse);
