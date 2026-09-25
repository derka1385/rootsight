import type { Request, Response } from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { PlantProfileOut, RefineRequest } from "@rootsight/shared/schema";
import { askJson, imageBlock, useMock } from "../claude";
import { REFINE_PROMPT } from "../prompts";

/** Paths of leaf values that differ, e.g. ["visual.leaves.gloss", "morphology.leaf.countNow"]. */
function changed(a: unknown, b: unknown, path = ""): string[] {
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => changed((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [path];
}

// POST /api/refine {photo, renderScreenshot, profile} -> PlantProfile
export async function refine(req: Request, res: Response) {
  const { photo, renderScreenshot, profile } = RefineRequest.parse(req.body);
  if (useMock()) {
    await sleep(600);
    return res.json(profile);
  }
  const t0 = Date.now();
  const next = await askJson(PlantProfileOut, REFINE_PROMPT, [
    { type: "text", text: "Image 1, real photo:" },
    imageBlock(photo),
    { type: "text", text: "Image 2, our render:" },
    imageBlock(renderScreenshot),
    { type: "text", text: `Current PlantProfile:\n${JSON.stringify(profile)}` },
  ], "max"); // Opus 5.5 at max effort: this profile drives the 3D render
  // Watch convergence during the demo: fewer changed fields per pass = render closer to the photo.
  const diff = changed(profile, next).filter((p) => p !== "facts");
  console.log(`[refine] ${diff.length} field(s) changed in ${Date.now() - t0} ms: ${diff.join(", ") || "none"}`);
  res.json(next);
}
