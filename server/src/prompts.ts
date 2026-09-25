
const UNITS = `Units: heights and lengths in cm, temperatures in °C, colors as #rrggbb hex.
The output drives a procedural 3D renderer, so numbers must be physically plausible for the species.`;

// The render must look like THIS plant, so ask for the specimen, not the species average.
const VISUAL = `- visual: describe THIS specimen as photographed, not a typical one. The 3D render is built from it.
  - Count what you see: stems from the soil, leaves (also set morphology.leaf.countNow), offsets.
  - Measure proportions from the photo. Use the pot rim as a size reference when visible (a typical
    houseplant pot is 12-25 cm across) to keep heights, leaf lengths and pot diameter consistent.
  - Sample colours from well-lit areas (avoid highlights and shadows). colorUnder: estimate if not visible.
  - Report the damage you actually see in condition (yellowing, brownTips, pests), consistent with healthNotes.
  - succulent.bodyForm is "none" for non-succulents (then ribCount 0, spineDensity 0, offsets 0).
  - pot.material "none" if no pot is visible; still estimate a sensible diameter.
  - Never skip a field: when unsure, give your best estimate and lower species.confidence if the photo is unclear.`;

export const ANALYZE_PROMPT = `You are a botanist. Identify the plant in the photo and describe it as a PlantProfile.
- species.confidence: your honest 0-1 certainty in the identification.
- wiki: botanical family, native region, a 2-3 sentence encyclopedia-style summary, care difficulty, and whether it is toxic to cats/dogs.
- morphology: describe the plant as it looks NOW in the photo (currentHeightCm, countNow), and matureHeightCm for a typical mature specimen grown indoors.
- stemColor and leaf.color: sample the actual colors visible in the photo.
- roots: typical root system for this species (you cannot see them; infer).
- care: practical indoor care; waterIntervalDays is the ideal interval between waterings.
- facts: 3 to 5 short, surprising facts (max ~15 words each).
- healthNotes: what you actually see: yellowing, pests, dry tips, leggy growth, or "looks healthy".
${VISUAL}
${UNITS}`;

export const REFINE_PROMPT = `You are checking a procedural 3D render of a plant against the real photo.
Image 1 is the real photo. Image 2 is our render. You also get the PlantProfile that produced the render.
Compare the two images field by field and return a corrected PlantProfile so the next render matches the
photo better:
1. Silhouette: overall width vs height, lean, symmetry, legginess (visual.silhouette, morphology heights).
2. Stems: how many, how thick, spacing between leaves (visual.stems, branchingAngleDeg, branchingDepth).
3. Leaves: count, size, shape, arrangement, tip, edge, splits/holes, variegation, gloss, droop
   (morphology.leaf, visual.leaves).
4. Colours: leaf, underside, stem, spines, pot, sampled from well-lit parts of the photo.
5. Succulent body, condition and pot (visual.succulent, visual.condition, visual.pot).
If the render is too big/small overall, fix heights and lengths, not only proportions.
Keep species, wiki, care and facts unless clearly wrong. Change only what is visibly off; keep every
other value identical so the plant doesn't jump between renders.
${UNITS}`;

export const WHATIF_PROMPT = `You simulate "what if" scenarios for a houseplant.
You get the plant's PlantProfile and a user question (e.g. "What if I water every 2 weeks?", "What if I move it to a dark corner?").
Return:
- profile: the PlantProfile adjusted to how the plant would grow under that scenario (growth rate, mature height, leaf color/count, healthNotes...). Keep species unchanged.
- explanation: 2-3 friendly sentences on what would happen and why.
Keep profile.visual consistent with the scenario (e.g. droop, yellowing, legginess, leaf count); if the
input has no visual block, describe the plant as it would look under the scenario.
${UNITS}`;
