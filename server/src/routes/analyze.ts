import type { Request, Response } from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { AnalyzeRequest, PlantProfileOut } from "@rootsight/shared/schema";
import { fixtures } from "@rootsight/shared/fixtures";
import { askJson, imageBlock, useMock } from "../claude";
import { ANALYZE_PROMPT } from "../prompts";

// POST /api/analyze {imageBase64, mediaType} -> PlantProfile
export async function analyze(req: Request, res: Response) {
  const photo = AnalyzeRequest.parse(req.body);
  if (useMock()) {
    await sleep(600);
    return res.json(fixtures.monstera);
  }
  res.json(await askJson(PlantProfileOut, ANALYZE_PROMPT, [imageBlock(photo), { type: "text", text: "Identify this plant." }]));
}
