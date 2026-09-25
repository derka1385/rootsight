import type { Request, Response } from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { PlantProfile, RefineRequest } from "@rootsight/shared/schema";
import { askJson, imageBlock, useMock } from "../claude";
import { REFINE_PROMPT } from "../prompts";

// POST /api/refine {photo, renderScreenshot, profile} -> PlantProfile
export async function refine(req: Request, res: Response) {
  const { photo, renderScreenshot, profile } = RefineRequest.parse(req.body);
  if (useMock()) {
    await sleep(600);
    return res.json(profile);
  }
  // TODO(claude-owner): loop refine up to N times until Claude says "good enough"?
  res.json(
    await askJson(PlantProfile, REFINE_PROMPT, [
      { type: "text", text: "Image 1, real photo:" },
      imageBlock(photo),
      { type: "text", text: "Image 2, our render:" },
      imageBlock(renderScreenshot),
      { type: "text", text: `Current PlantProfile:\n${JSON.stringify(profile)}` },
    ]),
  );
}
