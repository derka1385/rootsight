import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AnalyzeRequest, RefineRequest, WhatIfRequest } from "@rootsight/shared/schema";
import { useMock } from "./claude";
import { analyzePlant, refinePlant, simulateFuture } from "./pipeline";

/** The HTTP API, without listening (tests call it in-process). */
export function createApp() {
  const app = express();
  app.use(express.json({ limit: "15mb" })); // base64 photos; no CORS since Vite proxies /api

  // Lets the web tell whether it is talking to Claude or to the fixtures (never exposes the key).
  app.get("/api/health", (_req, res) => {
    res.json({ mock: useMock(), hasKey: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5", liveEnrichment: !useMock() && process.env.ENRICH_LIVE !== "false" });
  });
  // POST /api/analyze ImageInput -> PlantProfile
  app.post("/api/analyze", async (req, res) => { res.json(await analyzePlant(AnalyzeRequest.parse(req.body))); });
  // POST /api/refine {photo, renderScreenshot, profile} -> {profile, corrections, changed}
  app.post("/api/refine", async (req, res) => {
    const { photo, renderScreenshot, profile } = RefineRequest.parse(req.body);
    const t0 = Date.now();
    const result = await refinePlant(photo, renderScreenshot, profile);
    console.log(`[refine] ${result.changed.length} observation field(s) changed in ${Date.now() - t0} ms: ${result.changed.join(", ") || "none"}`);
    res.json(result);
  });
  // POST /api/whatif {profile, conditions, question} -> {conditions, explanation, inAYear, baseline}
  app.post("/api/whatif", async (req, res) => {
    const { profile, conditions, question } = WhatIfRequest.parse(req.body);
    res.json(await simulateFuture(profile, conditions, question));
  });

  // Express 5 forwards rejected async handlers here.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (!(err instanceof ZodError)) console.error(err);
    const status = err instanceof ZodError ? 400 : err.expose ? err.status : 502;
    res.status(status).json({ error: status === 400 ? "Bad request" : "Upstream error", details: err.message });
  };
  app.use(onError);
  return app;
}
