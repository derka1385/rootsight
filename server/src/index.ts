import { useMock } from "./claude";
import { createApp } from "./app";

try {
  process.loadEnvFile(); // server/.env; optional (mock mode needs no key)
} catch {}

const port = Number(process.env.PORT) || 8787;
createApp().listen(port, () => console.log(`API on http://localhost:${port} (mock: ${useMock()})`));
