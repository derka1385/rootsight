import { PlantIdentification, type PlantProfile } from "../schema";
import { buildPlantProfile, genericKnowledge } from "../knowledge";
import { librarySpecies } from "../species/library";
import monstera from "./monstera.json" with { type: "json" };
import basil from "./basil.json" with { type: "json" };
import cactus from "./cactus.json" with { type: "json" };
import dracaena from "./dracaena.json" with { type: "json" };
import ficus from "./ficus.json" with { type: "json" };

/** What Claude would read from each demo photo (mock mode returns these). Parsed so drift fails loudly. */
export const identifications = {
  basil: PlantIdentification.parse(basil),
  monstera: PlantIdentification.parse(monstera),
  ficus: PlantIdentification.parse(ficus),
  dracaena: PlantIdentification.parse(dracaena),
  cactus: PlantIdentification.parse(cactus),
};

/** The same identifications run through the real enrichment step (curated library) -> profiles. */
export const fixtures = Object.fromEntries(
  Object.entries(identifications).map(([k, id]) => [k, buildPlantProfile(id, librarySpecies(id.identity.scientificName, id.identity.aliases) ?? genericKnowledge(id))]),
) as Record<keyof typeof identifications, PlantProfile>;
