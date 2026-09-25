import { PlantProfile } from "../schema";
import monstera from "./monstera.json" with { type: "json" };
import basil from "./basil.json" with { type: "json" };
import cactus from "./cactus.json" with { type: "json" };

// Parsed at import so a fixture that drifts from the schema fails loudly.
export const fixtures = {
  monstera: PlantProfile.parse(monstera),
  basil: PlantProfile.parse(basil),
  cactus: PlantProfile.parse(cactus),
};
