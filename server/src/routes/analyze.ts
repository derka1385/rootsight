import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { AnalyzeRequest, PlantProfile, VisionPlantProfile } from "@rootsight/shared/schema";
import { observedMonstera } from "../../../shared/fixtures/observed";
import { askJson, imageBlock, useMock } from "../claude";
import { ANALYZE_PROMPT } from "../prompts";

// POST /api/analyze {imageBase64, mediaType} -> PlantProfile
export async function analyze(req: Request, res: Response) {
  const photo = AnalyzeRequest.parse(req.body);
  if (useMock()) {
    await sleep(600);
    return res.json(observedMonstera);
  }
  const t0 = Date.now();
  // High effort: this one call is what the whole 3D reconstruction is built from.
  const result = await askJson(VisionPlantProfile, ANALYZE_PROMPT, [imageBlock(photo), { type: "text", text: "Inventory this individual plant, then describe it." }], "high");
  const b = result.individual.blooms;
  console.log(`[analyze] ${result.species.scientificName} in ${Date.now() - t0} ms: ${result.morphology.leaf.countNow} leaves, density ${result.individual.crownDensity}, ${b.flowers} flowers, ${b.buds} buds, ${b.fruits} fruits`);
  const seed = createHash("sha256").update(photo.imageBase64).digest("hex").slice(0, 24);
  res.json(PlantProfile.parse({ ...result, individual: { ...result.individual, seed } }));
}
