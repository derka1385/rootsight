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
  const result = await askJson(VisionPlantProfile, ANALYZE_PROMPT, [imageBlock(photo), { type: "text", text: "Identify this individual plant and locate its visible major leaves." }]);
  const seed = createHash("sha256").update(photo.imageBase64).digest("hex").slice(0, 24);
  res.json(PlantProfile.parse({ ...result, individual: { ...result.individual, seed } }));
}
