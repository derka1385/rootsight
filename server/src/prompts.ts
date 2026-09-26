const UNITS = `Units: heights and lengths in cm, temperatures in °C, colors as #rrggbb hex.
The output drives a 3D reconstruction, so numbers must be physically plausible and consistent with each other.`;

// Three separate jobs, kept apart in the answer: the species card, THIS plant today, its future.
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

const GROW = `growth = the likely path of THIS plant from today, grounded in the species' real growth habit indoors.
- stages[0] is today: monthsFromNow 0 and numbers equal to the observation.
- Then 2-4 later stages in order with realistic timing for indoor growth, each with the height, canopy
  width, leaf count, newest-leaf length, maturity, axis count and fenestration it would have, plus the
  visible structural changes that get it there (new canes, splits appearing, side shoots, a woody base,
  shedding of lower leaves...). Growth changes structure, not just size.
- source "claude".`;

export const ANALYZE_PROMPT = `You are a botanist and a 3D reconstruction assistant. From one photo, return a PlantScan:
profile = the SPECIES card:
- species.confidence: your honest 0-1 certainty in the identification.
- wiki: family, native region, 2-3 sentence encyclopedia summary, care difficulty, toxicity to cats/dogs.
- morphology: typical species morphology (currentHeightCm = this plant's height, matureHeightCm = a typical mature indoor specimen).
- roots: typical root system (not visible; infer). care: practical indoor care.
- facts: 3 to 5 short, surprising facts (max ~15 words each). healthNotes: species-level care advice.
${OBSERVE}
${GROW}
${UNITS}`;

export const REFINE_PROMPT = `You are checking a 3D reconstruction of a plant against the real photo.
Image 1 is the real photo. Image 2 is our render of it. You also get the PlantScan behind the render.
Correct the OBSERVATION (and, if the size or stage was wrong, the growth stages) so the next render matches
the photo better. Work in this order, it is the order people notice:
1. Silhouette: plant height vs canopy width, lean, symmetry, where the foliage mass sits (leafClusters).
2. Architecture: number and height of stems/canes/crowns (axes), branching, archetype if clearly wrong.
3. Leaves: count, density, size range, orientation/droop, shape, fenestration, gloss.
4. Pot: shape, size relative to the plant, material, colour.
5. Colours: leaf, young leaf, underside, stem, soil; health cues.
Change only what is visibly off and keep every other value identical so the plant doesn't jump between
renders. Keep growth.stages[0] equal to the corrected observation. List each fix in corrections.
${UNITS}`;

export const WHATIF_PROMPT = `You simulate "what if" scenarios for one specific houseplant.
You get its PlantScan (species card, today's observation, growth path), the current growing conditions and a
question (water less, more light, repotting, moving it, fertilizing...).
Return:
- conditions: the conditions implied by the question (unchanged fields stay as given; repotting sets a
  larger potDiameterCm).
- growth: the re-planned future from today's stage under those conditions: stages[0] stays today; later
  stages change timing, size, leaf count, maturity and structural changes (e.g. etiolated leggy growth in
  low light, smaller yellowing leaves when under-watered, a growth spurt after repotting).
- vigor: expected 0-1 vigor under the scenario.
- explanation: 2-3 friendly sentences on what would happen to THIS plant and why.
${UNITS}`;
