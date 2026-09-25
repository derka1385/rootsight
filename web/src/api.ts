import type { z } from "zod";
import { PlantProfile, WhatIfResponse, type ImageInput } from "@rootsight/shared/schema";

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

export const analyze = (photo: ImageInput) => post("analyze", photo, PlantProfile);

export const refine = (photo: ImageInput, renderScreenshot: ImageInput, profile: PlantProfile) =>
  post("refine", { photo, renderScreenshot, profile }, PlantProfile);

export const whatIf = (profile: PlantProfile, question: string) =>
  post("whatif", { profile, question }, WhatIfResponse);
