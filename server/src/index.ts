import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { useMock } from "./claude";
import { analyze } from "./routes/analyze";
import { refine } from "./routes/refine";
import { whatif } from "./routes/whatif";

try {
  process.loadEnvFile(); // server/.env; optional (mock mode needs no key)
} catch {}

const app = express();
app.use(express.json({ limit: "15mb" })); // base64 photos; no CORS since Vite proxies /api

// Lets the web tell whether it is talking to Claude or to the fixtures (never exposes the key).
app.get("/api/health", (_req, res) => {
  res.json({ mock: useMock(), hasKey: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5" });
});
app.post("/api/analyze", analyze);
app.post("/api/refine", refine);
app.post("/api/whatif", whatif);

// Express 5 forwards rejected async handlers here.
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = err instanceof ZodError ? 400 : err.expose ? err.status : 502;
  res.status(status).json({ error: status === 400 ? "Bad request" : "Upstream error", details: err.message });
};
app.use(onError);

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`API on http://localhost:${port} (mock: ${useMock()})`));
