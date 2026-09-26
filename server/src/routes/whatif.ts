import type { Request, Response } from "express";
import { setTimeout as sleep } from "node:timers/promises";
import { WhatIfRequest, WhatIfResponse, type GrowthConditions } from "@rootsight/shared/schema";
import { growthAt, vigorOf } from "@rootsight/shared/simulation";
import { askJson, useMock } from "../claude";
import { WHATIF_PROMPT } from "../prompts";

/** Mock mode: read the scenario from the question with a few patterns, keep the growth path. */
function mockConditions(question: string, c: GrowthConditions): GrowthConditions {
  const q = question.toLowerCase(), next = { ...c };
  const every = q.match(/every\s+(\d+(?:\.\d+)?)?\s*(day|week|month)/);
  if (every) next.waterIntervalDays = Number(every[1] ?? 1) * { day: 1, week: 7, month: 30 }[every[2] as "day" | "week" | "month"];
  if (/dark|shade|less light|low light|corner/.test(q)) next.light = "low";
  else if (/full sun|direct sun|south/.test(q)) next.light = "full-sun";
  else if (/more light|bright|window/.test(q)) next.light = "bright-indirect";
  if (/repot|bigger pot|larger pot/.test(q)) next.potDiameterCm = Math.round(c.potDiameterCm * 1.4);
  return next;
}

// POST /api/whatif {scan, conditions, question} -> {conditions, growth, vigor, explanation}
// A what-if changes the future path, never today's observed plant.
export async function whatif(req: Request, res: Response) {
  const { scan, conditions, question } = WhatIfRequest.parse(req.body);
  if (useMock()) {
    await sleep(600);
    const next = mockConditions(question, conditions);
    const { vigor } = vigorOf(scan, next, scan.observation.frame.canopyWidthCm);
    const inAYear = growthAt(scan, 12, next);
    return res.json({
      conditions: next,
      growth: scan.growth,
      vigor,
      explanation: `(mock) In a year it would be about ${Math.round(inAYear.heightCm)} cm with ${inAYear.leafCount} leaves at ${Math.round(vigor * 100)}% vigor. Set USE_MOCK=false in server/.env for Claude's answer.`,
    } satisfies WhatIfResponse);
  }
  const answer = await askJson(WhatIfResponse, WHATIF_PROMPT, [
    { type: "text", text: `PlantScan:\n${JSON.stringify(scan)}\n\nCurrent conditions:\n${JSON.stringify(conditions)}\n\nQuestion: ${question}` },
  ]);
  res.json({ ...answer, growth: { ...answer.growth, source: "claude" } });
}
