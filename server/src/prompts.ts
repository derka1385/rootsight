// TODO(claude-owner): iterate on these with real photos.

const UNITS = `Units: heights and lengths in cm, temperatures in °C, colors as #rrggbb hex.
The output drives a procedural 3D renderer, so numbers must be physically plausible for the species.`;


const OBSERVATIONS = `The photo describes the individual; species knowledge is only a prior for hidden parts.
Use morphology.currentHeightCm above soil (exclude the pot), leaf.countNow for estimated total leaf count,
leaf.lengthCm for the largest representative mature blade, and leaf.color for observed diffuse top color.
Fill visual groups for observed proportions, lean, stem count/thickness/internodes, blade outline and finish,
localized yellowing/brown tips, and container proportions. Never invent damage from species tendencies.
Fill individual: crownShape, crownDensity, maturity, estimatedBranchCount, averageLeafAngleDeg,
leafAsymmetry, stemTaper, stemCurvature, depthToWidth. Fractions are normalized 0..1; unknown depth should be conservative.
individual.leaves lists up to 32 clearly visible major blades, not invented hidden leaves. Use [] for leafless cacti.
Each leaf has a stable id (leaf-0 etc), x in [-1,1] (photo-left/right relative to half canopy width),
y in [-1.5,1.5] (blade BASE height above soil / plant height, negative for trailing leaves),
layer foreground/middle/background from overlap, size (length / morphology.leaf.lengthCm),
angleDeg (0 upright, 90 horizontal, 180 hanging), azimuthDeg (0 toward photo camera, 90 photo-right, -90 photo-left),
and stemIndex (0-based stem it belongs to). Place blade bases, not blade centers or tips.
The visible leaf list may be shorter than total leaf.countNow. Do not exceed countNow or invent precise occluded positions.
Preserve proportions and major leaf positions over decorative detail. Hidden structure will be generated from botanical defaults.`;

export const ANALYZE_PROMPT = `You are a botanist. Identify the plant in the photo and describe it as a PlantProfile.
- species.confidence: your honest 0-1 certainty in the identification.
- wiki: botanical family, native region, a 2-3 sentence encyclopedia-style summary, care difficulty, and whether it is toxic to cats/dogs.
- morphology: describe the plant as it looks NOW in the photo (currentHeightCm, countNow), and matureHeightCm for a typical mature specimen grown indoors.
- stemColor and leaf.color: sample the actual colors visible in the photo.
- roots: typical root system for this species (you cannot see them; infer).
- care: practical indoor care; waterIntervalDays is the ideal interval between waterings.
- facts: 3 to 5 short, surprising facts (max ~15 words each).
- healthNotes: what you actually see: yellowing, pests, dry tips, leggy growth, or "looks healthy".
${OBSERVATIONS}
${UNITS}`;

export const REFINE_PROMPT = `You are checking a procedural 3D render of a plant against the real photo.
Image 1 is the real photo. Image 2 is our render. You also get the PlantProfile that produced the render.
Return a corrected PlantProfile so the next render matches the photo better: adjust height, colors,
leaf shape/size/count, branching angle/depth, growth form. Keep species and care unless clearly wrong.
Change only what is visibly off; keep everything else identical. Preserve leaf IDs and stemIndex for the same visible blades; never reorder or renumber them.
${OBSERVATIONS}
${UNITS}`;

export const WHATIF_PROMPT = `You simulate "what if" scenarios for a houseplant.
You get the plant's PlantProfile and a user question (e.g. "What if I water every 2 weeks?", "What if I move it to a dark corner?").
Keep individual.seed, individual.leaves IDs/positions and visual observations unless the question explicitly changes the specimen.
Return:
- profile: the PlantProfile adjusted to how the plant would grow under that scenario (growth rate, mature height, leaf color/count, healthNotes...). Keep species unchanged.
- explanation: 2-3 friendly sentences on what would happen and why.
${UNITS}`;
