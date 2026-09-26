import type { z } from "zod";
import { PlantScan, RefineResult, WhatIfResponse, type GrowthConditions, type ImageInput } from "@rootsight/shared/schema";

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

/** Photo -> species card + reconstruction of this plant today + its growth path. */
export const analyze = (photo: ImageInput) => post("analyze", photo, PlantScan);

/** Photo + our render -> a scan whose observation (today's plant) is closer to the photo. */
export const refine = (photo: ImageInput, renderScreenshot: ImageInput, scan: PlantScan) =>
  post("refine", { photo, renderScreenshot, scan }, RefineResult);

/** A scenario re-plans the future (conditions, growth path), never today's plant. */
export const whatIf = (scan: PlantScan, conditions: GrowthConditions, question: string) =>
  post("whatif", { scan, conditions, question }, WhatIfResponse);
