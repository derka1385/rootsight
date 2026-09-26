import type { Request, Response } from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { RefineRequest, RefineResponse, type PlantScan, type RefineResult } from "@rootsight/shared/schema";
import { askJson, imageBlock, useMock } from "../claude";
import { REFINE_PROMPT } from "../prompts";

/** Paths of leaf values that differ, e.g. ["observation.leaves.count", "observation.frame.canopyWidthCm"]. */
function changed(a: unknown, b: unknown, path = ""): string[] {
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => changed((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [path];
}

// POST /api/refine {photo, renderScreenshot, scan} -> {scan, corrections}
// Refine rebuilds TODAY's plant closer to the photo; the species card is never touched here.
export async function refine(req: Request, res: Response) {
  const { photo, renderScreenshot, scan } = RefineRequest.parse(req.body);
  if (useMock()) {
    await sleep(600);
    return res.json({ scan, corrections: ["(mock) set USE_MOCK=false in server/.env to compare with Claude"] } satisfies RefineResult);
  }
  const t0 = Date.now();
  const fix = await askJson(RefineResponse, REFINE_PROMPT, [
    { type: "text", text: "Image 1, real photo:" },
    imageBlock(photo),
    { type: "text", text: "Image 2, our render:" },
    imageBlock(renderScreenshot),
    { type: "text", text: `Current PlantScan:\n${JSON.stringify(scan)}` },
  ], "medium");
  const next: PlantScan = { ...scan, observation: fix.observation, growth: { ...fix.growth, source: "claude" } };
  // Watch convergence during the demo: fewer changed fields per pass = render closer to the photo.
  const diff = changed(scan.observation, next.observation);
  console.log(`[refine] ${diff.length} observation field(s) changed in ${Date.now() - t0} ms: ${diff.join(", ") || "none"}`);
  res.json({ scan: next, corrections: fix.corrections } satisfies RefineResult);
}
