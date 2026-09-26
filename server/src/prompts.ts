const UNITS = `Units: heights and lengths in cm, temperatures in °C, colors as #rrggbb hex.
The output drives a 3D reconstruction, so numbers must be physically plausible and consistent with each other.`;

// What the photo shows about THIS plant; the renderer rebuilds today's plant from it.
const OBSERVE = `observation = THIS plant as photographed, not a typical one. The "Scanned plant" 3D view is rebuilt from it.
- Use the pot rim as the size reference when visible (houseplant pots are usually 10-30 cm across);
  keep plantHeightCm, canopyWidthCm, leaf lengths and pot size consistent with each other.
- archetype: the renderer family that best matches the VISIBLE architecture (see the schema description).
- structure.axes: one entry per separate stem, cane, trunk or crown leaving the soil, largest first.
  Dracaena/Yucca canes are "cane" with their bare height; Monstera/Philodendron/Alocasia are "crown".
- structure.leafClusters: where the foliage mass sits (e.g. one per cane top, or a dome at 0.7 height).
- leaves: count what you see (estimate hidden ones behind), give the real size range, and describe
  orientation/droop as seen. fenestration is what the VISIBLE leaves show, not what the species can do.
- colors: sample well-lit areas, avoid highlights and deep shadows.
- health: what is visible. maturity/stage: where this individual is in its life, from its size and leaf form.
- confidence: be honest; lower it when the photo is partial, blurry or has no scale reference.
- succulent.bodyForm "none" for non-succulents (then ribCount 0, spineDensity 0, offsets 0).`;

export const IDENTIFY_PROMPT = `You are a botanist and a 3D reconstruction assistant. From one photo, return a PlantIdentification:
- identity: the species (binomial scientificName), family, your honest 0-1 confidence, and common aliases.
- wiki: native region, a 2-3 sentence encyclopedia summary, care difficulty, toxicity to cats/dogs.
- care: practical indoor care; waterIntervalDays is the ideal interval between waterings.
- facts: 3 to 5 short, surprising facts (max ~15 words each).
${OBSERVE}
${UNITS}`;

// Species knowledge comes from references, not from memory alone: Claude only structures what they say.
export const NORMALIZE_PROMPT = `You turn botanical reference material about one species into structured morphology for a 3D renderer.
You get reference text (e.g. Wikipedia's description) and reference photos of the species.
Return the species prior and its life stages for a plant grown INDOORS in a pot:
- prior: architecture (archetype, habit, branching, leaf arrangement/shape/size ranges for juvenile and mature
  leaves, stem structure and mature thickness, petiole, canopy form and width/height, roots, mature indoor
  height, months from a young plant to mature form, mature fenestration, how juveniles differ, and a few
  rendering-relevant notes).
- stages: 4-5 stages from SEEDLING to LARGE_MATURE with relativeAge and relativeHeight as fractions of
  maturity (monotonic), canopy width/height, the leaf count range kept, leaf maturity, fenestration, axis
  count (stems/canes/crowns/offsets) and branching density, and 1-3 visible morphological changes each.
Prefer what the references state; where they are silent use typical horticultural knowledge, and keep
numbers plausible rather than falsely precise.
${UNITS}`;

export const REFINE_PROMPT = `You are checking a 3D reconstruction of a plant against the real photo.
Image 1 is the real photo. Image 2 is our render of it. You also get the PlantProfile behind the render.
Return a RefinePatch: ONLY the observation fields that are visibly off, with corrected values, plus one
short correction note per fix. Omit everything that is already right. Work in the order people notice:
1. Silhouette: plant height vs canopy width, lean, symmetry, where the foliage mass sits (leafClusters).
2. Architecture: number and height of stems/canes/crowns (structure.axes), branching density.
3. Leaves: count, density/fullness, size range, orientation/droop, fenestration, gloss.
4. Maturity and stage if the render looks younger or older than the photo.
5. Pot shape/size/colour and colour direction of leaves and stems.
Keep changes proportionate: nudge toward the photo, do not rewrite the plant.
${UNITS}`;

export const WHATIF_PROMPT = `You simulate "what if" scenarios for one specific houseplant.
You get its PlantProfile (species, today's observation, personalised growth stages), the current growing
conditions and a question (water less or more, more or less light, repotting, fertilising, humidity...).
Our simulator moves the plant along its growth stages at a pace set by these conditions:
waterIntervalDays (hydration: longer than ideal wilts and slows; much shorter rots roots), light (vs the
species' preference), potDiameterCm (a root-bound canopy stalls; repotting frees it) and pace (other care as a
growth-rate multiplier, 1 = typical, e.g. 1.2 with regular feeding, 0.7 in cold drafts).
Return:
- conditions: the conditions implied by the question (unchanged fields stay as given).
- explanation: 2-3 friendly sentences on what would happen to THIS plant and why, in terms of its growth
  (leaf size and maturity, new leaves, droop, colour, stems).
${UNITS}`;
