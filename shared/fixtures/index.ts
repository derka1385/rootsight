import { PlantProfile } from "../schema";
import monstera from "./monstera.json" with { type: "json" };
import basil from "./basil.json" with { type: "json" };
import cactus from "./cactus.json" with { type: "json" };
// Live Claude scans of two CC-licensed flowering-plant photos (sources in docs/photo-reconstruction/README.md).
import cyclamen from "./cyclamen.json" with { type: "json" };
import kalanchoe from "./kalanchoe.json" with { type: "json" };

// Parsed at import so a fixture that drifts from the schema fails loudly.
export const fixtures = {
  monstera: PlantProfile.parse(monstera),
  basil: PlantProfile.parse(basil),
  cactus: PlantProfile.parse(cactus),
  cyclamen: PlantProfile.parse(cyclamen),
  kalanchoe: PlantProfile.parse(kalanchoe),
};
