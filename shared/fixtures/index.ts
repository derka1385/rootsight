import { PlantScan } from "../schema";
import monstera from "./monstera.json" with { type: "json" };
import basil from "./basil.json" with { type: "json" };
import cactus from "./cactus.json" with { type: "json" };

// Mock-mode scans (species card + what the photo shows + growth path). Parsed at import so a
// fixture that drifts from the schema fails loudly.
export const fixtures = {
  basil: PlantScan.parse(basil),
  monstera: PlantScan.parse(monstera),
  cactus: PlantScan.parse(cactus),
};
