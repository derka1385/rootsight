// TODO(claude-owner): iterate on these with real photos.

const UNITS = `Units: heights and lengths in cm, temperatures in °C, colors as #rrggbb hex.
The output drives a procedural 3D renderer, so numbers must be physically plausible for the species.`;

export const ANALYZE_PROMPT = `You are a botanist. Identify the plant in the photo and describe it as a PlantProfile.
- species.confidence: your honest 0-1 certainty in the identification.
- wiki: botanical family, native region, a 2-3 sentence encyclopedia-style summary, care difficulty, and whether it is toxic to cats/dogs.
- morphology: describe the plant as it looks NOW in the photo (currentHeightCm, countNow), and matureHeightCm for a typical mature specimen grown indoors.
- stemColor and leaf.color: sample the actual colors visible in the photo.
- roots: typical root system for this species (you cannot see them; infer).
- care: practical indoor care; waterIntervalDays is the ideal interval between waterings.
- facts: 3 to 5 short, surprising facts (max ~15 words each).
- healthNotes: what you actually see: yellowing, pests, dry tips, leggy growth, or "looks healthy".
${UNITS}`;

export const REFINE_PROMPT = `You are checking a procedural 3D render of a plant against the real photo.
Image 1 is the real photo. Image 2 is our render. You also get the PlantProfile that produced the render.
Return a corrected PlantProfile so the next render matches the photo better: adjust height, colors,
leaf shape/size/count, branching angle/depth, growth form. Keep species and care unless clearly wrong.
Change only what is visibly off; keep everything else identical.
${UNITS}`;

export const WHATIF_PROMPT = `You simulate "what if" scenarios for a houseplant.
You get the plant's PlantProfile and a user question (e.g. "What if I water every 2 weeks?", "What if I move it to a dark corner?").
Return:
- profile: the PlantProfile adjusted to how the plant would grow under that scenario (growth rate, mature height, leaf color/count, healthNotes...). Keep species unchanged.
- explanation: 2-3 friendly sentences on what would happen and why.
${UNITS}`;
