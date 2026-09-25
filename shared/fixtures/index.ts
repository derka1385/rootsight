import { PlantProfile } from "../schema";
import monstera from "./monstera.json" with { type: "json" };
import basil from "./basil.json" with { type: "json" };
import cactus from "./cactus.json" with { type: "json" };

// Parsed at import so a fixture that drifts from the schema fails loudly.
export const fixtures = {
  // Basil first: it is the strongest render, so it is the hero and the first sample in Explore.
  basil: PlantProfile.parse(basil),
  monstera: PlantProfile.parse(monstera),
  cactus: PlantProfile.parse(cactus),
};
