import type { Request, Response } from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { WhatIfRequest, WhatIfResponse } from "@rootsight/shared/schema";
import { askJson, useMock } from "../claude";
import { WHATIF_PROMPT } from "../prompts";

// POST /api/whatif {profile, question} -> {profile, explanation}
export async function whatif(req: Request, res: Response) {
  const { profile, question } = WhatIfRequest.parse(req.body);
  if (useMock()) {
    await sleep(600);
    return res.json({
      profile,
      explanation: `(mock) "${question}": set USE_MOCK=false in server/.env to ask Claude for real.`,
    } satisfies WhatIfResponse);
  }
  res.json(
    await askJson(WhatIfResponse, WHATIF_PROMPT, [
      { type: "text", text: `PlantProfile:\n${JSON.stringify(profile)}\n\nQuestion: ${question}` },
    ]),
  );
}
