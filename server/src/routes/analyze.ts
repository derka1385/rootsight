import type { Request, Response } from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { AnalyzeRequest, PlantScan } from "@rootsight/shared/schema";
import { fixtures } from "@rootsight/shared/fixtures";
import { askJson, imageBlock, useMock } from "../claude";
import { ANALYZE_PROMPT } from "../prompts";

// POST /api/analyze {imageBase64, mediaType} -> PlantScan {profile, observation, growth}
export async function analyze(req: Request, res: Response) {
  const photo = AnalyzeRequest.parse(req.body);
  if (useMock()) {
    await sleep(600);
    return res.json(fixtures.monstera);
  }
  // Medium effort: one call identifies the species, reconstructs today's plant and plans its growth.
  res.json(await askJson(PlantScan, ANALYZE_PROMPT, [imageBlock(photo), { type: "text", text: "Scan this plant." }], "medium"));
}
