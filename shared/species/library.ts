import { SpeciesKnowledge, type SpeciesMorphologyPrior, type SpeciesStage } from "../schema";

/*
 * Curated species knowledge: morphology priors and life stages for common houseplants, written from
 * horticultural references (RHS/ASPCA/Missouri Botanical Garden plant finder and Wikipedia species
 * articles) and checked against photos. It is the static fallback of the enrichment pipeline and
 * what mock mode demos with. Numbers are indoor, rounded, and deliberately not falsely precise.
 */

type StageRow = [SpeciesStage["stage"], relativeAge: number, relativeHeight: number, canopyWidthToHeight: number, leafMin: number, leafMax: number, leafMaturity: number, fenestration: number, axes: number, branchDensity: number, notes: string[]];

const stages = (rows: StageRow[]): SpeciesStage[] => rows.map(([stage, relativeAge, relativeHeight, canopyWidthToHeight, min, max, leafMaturity, fenestration, axes, branchDensity, morphologicalNotes]) => ({
  stage, relativeAge, relativeHeight, canopyWidthToHeight, leafCount: { min, max }, leafMaturity, fenestration, axes, branchDensity, morphologicalNotes,
}));

const entry = (scientificName: string, prior: SpeciesMorphologyPrior, rows: StageRow[], wikipedia: string): SpeciesKnowledge =>
  SpeciesKnowledge.parse({
    scientificName, prior, stages: stages(rows),
    sources: [
      { provider: "library", title: `Rootsight curated prior: ${scientificName}` },
      { provider: "wikipedia", title: scientificName, url: `https://en.wikipedia.org/wiki/${wikipedia}`, license: "CC BY-SA 4.0" },
    ],
  });

export const SPECIES_LIBRARY: SpeciesKnowledge[] = [
  entry("Monstera deliciosa", {
    archetype: "aroid", growthHabit: "climbing", branchingPattern: "none", leafArrangement: "alternate", leafShape: "fenestrated",
    leafLengthCm: { juvenile: { min: 8, max: 25 }, mature: { min: 40, max: 90 } }, leafWidthToLength: 0.9,
    stem: { structure: "crown", matureThicknessMm: 35 }, petiole: { present: true, lengthToBlade: 1.1 },
    canopyForm: "spreading", canopyWidthToHeight: 0.9, roots: { type: "aerial", maxDepthCm: 40, maxSpreadCm: 50 },
    matureHeightCm: 250, monthsToMaturity: 48, fenestrationMature: 0.85,
    juvenileVsMature: "Juvenile leaves are solid hearts; holes along the midrib then marginal splits appear as the plant matures and climbs.",
    notes: ["Very glossy, leathery blades held on long grooved petioles", "Leaves emerge rolled and unfurl", "Thick aerial roots from the stem nodes", "Lower leaves shed as the stem lengthens"],
  }, [
    ["SEEDLING", 0.02, 0.06, 1.1, 1, 3, 0, 0, 1, 0, ["Two or three solid heart-shaped leaves"]],
    ["JUVENILE", 0.15, 0.16, 1.3, 3, 6, 0.2, 0.05, 1, 0, ["Bigger solid leaves, the newest may show a first notch"]],
    ["YOUNG", 0.4, 0.3, 1.3, 6, 10, 0.5, 0.45, 1, 0, ["Holes along the midrib", "First marginal splits on new leaves"]],
    ["MATURE", 0.75, 0.6, 1.1, 9, 14, 0.8, 0.75, 1, 0.1, ["Deep splits and a second row of holes", "Aerial roots, a climbing stem"]],
    ["LARGE_MATURE", 1, 1, 0.8, 10, 16, 1, 0.85, 2, 0.2, ["Huge fully fenestrated leaves on a pole", "Bare lower stem"]],
  ], "Monstera_deliciosa"),

  entry("Ocimum basilicum", {
    archetype: "herb", growthHabit: "bushy", branchingPattern: "opposite-pairs", leafArrangement: "opposite", leafShape: "ovate",
    leafLengthCm: { juvenile: { min: 2, max: 5 }, mature: { min: 4, max: 10 } }, leafWidthToLength: 0.62,
    stem: { structure: "herbaceous", matureThicknessMm: 7 }, petiole: { present: true, lengthToBlade: 0.3 },
    canopyForm: "dome", canopyWidthToHeight: 0.9, roots: { type: "fibrous", maxDepthCm: 20, maxSpreadCm: 25 },
    matureHeightCm: 55, monthsToMaturity: 4, fenestrationMature: 0,
    juvenileVsMature: "Seedlings are single stems with a few leaf pairs; mature plants branch at every node into a dense dome, then flower.",
    notes: ["Square green stems", "Glossy, slightly cupped, bright green leaves", "Opposite leaf pairs at 90 degrees"],
  }, [
    ["SEEDLING", 0.1, 0.12, 0.8, 4, 8, 0.2, 0, 1, 0, ["A single stem with a few leaf pairs"]],
    ["JUVENILE", 0.3, 0.3, 0.9, 12, 30, 0.5, 0, 3, 0.2, ["Side shoots from the lower nodes"]],
    ["YOUNG", 0.55, 0.5, 1, 30, 70, 0.7, 0, 6, 0.5, ["Branches at most nodes, the canopy fills in"]],
    ["MATURE", 0.8, 0.8, 0.95, 70, 140, 0.9, 0, 9, 0.8, ["A dense, rounded bush"]],
    ["LARGE_MATURE", 1, 1, 0.85, 100, 180, 1, 0, 12, 0.9, ["Flower spikes at the tips", "Woody base, smaller upper leaves"]],
  ], "Basil"),

  entry("Echinocactus grusonii", {
    archetype: "cactus", growthHabit: "columnar", branchingPattern: "offsets", leafArrangement: "none", leafShape: "needle",
    leafLengthCm: { juvenile: { min: 1, max: 2 }, mature: { min: 3, max: 5 } }, leafWidthToLength: 0.05,
    stem: { structure: "succulent-body", matureThicknessMm: 600 }, petiole: { present: false, lengthToBlade: 0 },
    canopyForm: "globe", canopyWidthToHeight: 1.1, roots: { type: "fibrous", maxDepthCm: 25, maxSpreadCm: 40 },
    matureHeightCm: 60, monthsToMaturity: 240, fenestrationMature: 0,
    juvenileVsMature: "Young plants are small ribbed globes; old ones become wide barrels with a woolly crown and many ribs, sometimes with pups.",
    notes: ["Golden radial spines in clusters on each rib", "Woolly yellow crown on older plants", "Ribs become more numerous with age"],
  }, [
    ["SEEDLING", 0.02, 0.05, 1, 0, 0, 0.2, 0, 1, 0, ["A tiny spiny globe"]],
    ["JUVENILE", 0.15, 0.15, 1.1, 0, 0, 0.4, 0, 1, 0, ["A ribbed globe with dense golden spines"]],
    ["YOUNG", 0.4, 0.35, 1.15, 0, 0, 0.6, 0, 1, 0, ["Wider and flatter-topped, more ribs"]],
    ["MATURE", 0.75, 0.7, 1.1, 0, 0, 0.85, 0, 2, 0, ["Woolly crown and flowers", "A pup may appear at the base"]],
    ["LARGE_MATURE", 1, 1, 1, 0, 0, 1, 0, 3, 0, ["A broad old barrel with offsets"]],
  ], "Echinocactus_grusonii"),

  entry("Dracaena fragrans", {
    archetype: "cane", growthHabit: "upright", branchingPattern: "sympodial", leafArrangement: "whorled", leafShape: "strap",
    leafLengthCm: { juvenile: { min: 15, max: 35 }, mature: { min: 30, max: 60 } }, leafWidthToLength: 0.12,
    stem: { structure: "cane", matureThicknessMm: 60 }, petiole: { present: false, lengthToBlade: 0 },
    canopyForm: "vase", canopyWidthToHeight: 0.7, roots: { type: "fibrous", maxDepthCm: 35, maxSpreadCm: 35 },
    matureHeightCm: 200, monthsToMaturity: 60, fenestrationMature: 0,
    juvenileVsMature: "Young plants are a single leafy rosette; with age the stem becomes a bare, ringed cane topped by one or more tufts.",
    notes: ["Arching strap leaves in dense terminal rosettes", "Canes ringed with old leaf scars", "Often several canes of different heights per pot"],
  }, [
    ["SEEDLING", 0.03, 0.08, 1.2, 5, 10, 0.3, 0, 1, 0, ["A single rosette at soil level"]],
    ["JUVENILE", 0.2, 0.25, 1, 12, 25, 0.6, 0, 1, 0, ["A short stem lifts the rosette"]],
    ["YOUNG", 0.45, 0.5, 0.8, 20, 40, 0.8, 0, 2, 0.1, ["Bare ringed cane below the tuft", "A second crown may break"]],
    ["MATURE", 0.75, 0.75, 0.7, 30, 60, 0.95, 0, 3, 0.2, ["Several tufts on tall canes"]],
    ["LARGE_MATURE", 1, 1, 0.65, 45, 90, 1, 0, 5, 0.35, ["Branched canes, each with its own crown"]],
  ], "Dracaena_fragrans"),

  entry("Ficus elastica", {
    archetype: "tree", growthHabit: "tree", branchingPattern: "monopodial", leafArrangement: "alternate", leafShape: "ovate",
    leafLengthCm: { juvenile: { min: 10, max: 20 }, mature: { min: 20, max: 35 } }, leafWidthToLength: 0.5,
    stem: { structure: "woody", matureThicknessMm: 45 }, petiole: { present: true, lengthToBlade: 0.15 },
    canopyForm: "column", canopyWidthToHeight: 0.55, roots: { type: "fibrous", maxDepthCm: 40, maxSpreadCm: 45 },
    matureHeightCm: 250, monthsToMaturity: 72, fenestrationMature: 0,
    juvenileVsMature: "Young plants are one upright stem with large leathery leaves; older ones lignify, branch after pruning or damage and thicken into a small tree.",
    notes: ["Thick, glossy, leathery oval leaves with a pointed tip", "New leaves emerge from a red sheath", "Woody grey-brown trunk"],
  }, [
    ["SEEDLING", 0.03, 0.08, 0.6, 3, 6, 0.3, 0, 1, 0, ["A single stem with a few leaves"]],
    ["JUVENILE", 0.2, 0.25, 0.55, 8, 15, 0.6, 0, 1, 0, ["An upright stem, leaves all the way down"]],
    ["YOUNG", 0.45, 0.5, 0.55, 15, 28, 0.85, 0, 1, 0.15, ["The stem turns woody at the base"]],
    ["MATURE", 0.75, 0.75, 0.6, 25, 45, 1, 0, 3, 0.45, ["Side branches, a woody trunk"]],
    ["LARGE_MATURE", 1, 1, 0.7, 40, 70, 1, 0, 6, 0.7, ["A small branched tree, bare lower trunk"]],
  ], "Ficus_elastica"),

  entry("Epipremnum aureum", {
    archetype: "vine", growthHabit: "trailing", branchingPattern: "basal-clump", leafArrangement: "alternate", leafShape: "cordate",
    leafLengthCm: { juvenile: { min: 5, max: 12 }, mature: { min: 10, max: 20 } }, leafWidthToLength: 0.7,
    stem: { structure: "herbaceous", matureThicknessMm: 8 }, petiole: { present: true, lengthToBlade: 0.5 },
    canopyForm: "cascading", canopyWidthToHeight: 1.5, roots: { type: "fibrous", maxDepthCm: 20, maxSpreadCm: 30 },
    matureHeightCm: 150, monthsToMaturity: 24, fenestrationMature: 0,
    juvenileVsMature: "Indoors it stays in its juvenile form: heart-shaped, often gold-marbled leaves on long trailing stems.",
    notes: ["Gold or cream marbling on glossy green", "Long trailing vines over the pot rim"],
  }, [
    ["SEEDLING", 0.05, 0.1, 1.2, 3, 8, 0.4, 0, 2, 0, ["A few short vines"]],
    ["JUVENILE", 0.25, 0.3, 1.5, 10, 25, 0.6, 0, 3, 0.1, ["Vines start to trail over the rim"]],
    ["YOUNG", 0.5, 0.55, 1.6, 25, 50, 0.8, 0, 4, 0.2, ["Long cascading vines"]],
    ["MATURE", 0.8, 0.8, 1.6, 45, 90, 0.9, 0, 5, 0.3, ["Dense curtain of trailing stems"]],
    ["LARGE_MATURE", 1, 1, 1.5, 70, 130, 1, 0, 6, 0.35, ["Vines longer than the pot is tall"]],
  ], "Epipremnum_aureum"),

  entry("Dracaena trifasciata", {
    archetype: "grass", growthHabit: "clumping", branchingPattern: "basal-clump", leafArrangement: "basal", leafShape: "strap",
    leafLengthCm: { juvenile: { min: 10, max: 30 }, mature: { min: 40, max: 90 } }, leafWidthToLength: 0.09,
    stem: { structure: "crown", matureThicknessMm: 30 }, petiole: { present: false, lengthToBlade: 0 },
    canopyForm: "vase", canopyWidthToHeight: 0.5, roots: { type: "rhizome", maxDepthCm: 25, maxSpreadCm: 40 },
    matureHeightCm: 90, monthsToMaturity: 48, fenestrationMature: 0,
    juvenileVsMature: "Young plants are a few short upright leaves; rhizomes send up new fans until the pot is a dense clump of tall swords.",
    notes: ["Stiff, upright, sword-like leaves", "Grey-green cross-banding, often yellow margins", "Succulent, matte-satin surface"],
  }, [
    ["SEEDLING", 0.05, 0.12, 0.6, 2, 4, 0.3, 0, 1, 0, ["Two to four short upright leaves"]],
    ["JUVENILE", 0.25, 0.35, 0.5, 4, 8, 0.6, 0, 1, 0, ["A single upright fan"]],
    ["YOUNG", 0.5, 0.6, 0.5, 8, 16, 0.8, 0, 2, 0.2, ["A second fan from a rhizome"]],
    ["MATURE", 0.8, 0.85, 0.5, 14, 26, 0.95, 0, 4, 0.4, ["A dense clump of tall swords"]],
    ["LARGE_MATURE", 1, 1, 0.55, 22, 40, 1, 0, 6, 0.5, ["The clump fills and may crack a thin pot"]],
  ], "Dracaena_trifasciata"),

  entry("Chlorophytum comosum", {
    archetype: "grass", growthHabit: "rosette", branchingPattern: "basal-clump", leafArrangement: "basal", leafShape: "strap",
    leafLengthCm: { juvenile: { min: 8, max: 20 }, mature: { min: 20, max: 45 } }, leafWidthToLength: 0.05,
    stem: { structure: "crown", matureThicknessMm: 20 }, petiole: { present: false, lengthToBlade: 0 },
    canopyForm: "cascading", canopyWidthToHeight: 1.6, roots: { type: "tuberous", maxDepthCm: 20, maxSpreadCm: 30 },
    matureHeightCm: 40, monthsToMaturity: 18, fenestrationMature: 0,
    juvenileVsMature: "Young plants are a small tuft; mature ones form an arching fountain and send out stolons with baby plantlets.",
    notes: ["Arching narrow leaves, often with a cream central stripe", "Fountain-shaped rosette"],
  }, [
    ["SEEDLING", 0.05, 0.2, 1.2, 4, 8, 0.3, 0, 1, 0, ["A small upright tuft"]],
    ["JUVENILE", 0.25, 0.45, 1.4, 10, 20, 0.6, 0, 1, 0, ["Leaves begin to arch"]],
    ["YOUNG", 0.5, 0.7, 1.6, 20, 35, 0.8, 0, 2, 0.1, ["An arching fountain"]],
    ["MATURE", 0.8, 0.9, 1.7, 30, 55, 0.95, 0, 3, 0.3, ["Stolons with baby plantlets"]],
    ["LARGE_MATURE", 1, 1, 1.8, 45, 80, 1, 0, 4, 0.4, ["Several rosettes, plantlets hanging below the rim"]],
  ], "Chlorophytum_comosum"),
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").trim();
/** Old names still used in shops (Sansevieria = Dracaena trifasciata). */
const SYNONYMS: Record<string, string> = { "sansevieria trifasciata": "Dracaena trifasciata", "scindapsus aureus": "Epipremnum aureum" };

/** Curated knowledge for a species (exact binomial, synonym, or genus + epithet match), or null. */
export function librarySpecies(scientificName: string, aliases: string[] = []): SpeciesKnowledge | null {
  for (const name of [scientificName, ...aliases]) {
    const key = norm(name).split(" ").slice(0, 2).join(" ");
    const target = SYNONYMS[key] ?? key;
    const hit = SPECIES_LIBRARY.find(k => norm(k.scientificName) === norm(target));
    if (hit) return hit;
  }
  return null;
}
