import { Vector3 } from "three";
import type { GrowthConditions, GrowthStage, PlantObservation, PlantScan } from "@rootsight/shared/schema";
import { defaultConditions, growthAt, type GrowthState } from "@rootsight/shared/simulation";
import { clamp01, smoothstep } from "./procedural";
import { visualOf, type RenderProfile, type Visual } from "./visual";

/*
 * C. The render plan: everything the 3D renderers need, resolved from a scan.
 *
 *  Scanned mode  = the observation, rendered as literally as possible (counts, sizes, pot, colours,
 *                  where the stems and leaf masses are). Species priors only fill what the photo
 *                  cannot show (the far side, hidden stems, leaf venation).
 *  Future mode   = the same plant, advanced along its GrowthPlan by growthAt(): stages add leaves,
 *                  axes and maturity (new leaf forms), the canopy re-spreads, old leaves are shed.
 *
 * Renderers never read the raw scan; they read this plan.
 */

export type RenderMode = "scanned" | "future";

/** The default camera looks from this azimuth (see SceneCanvas); photo directions are relative to it. */
export const CAMERA_AZ = Math.atan2(1.5, 2.3);

/** A photo direction ("left of the plant as photographed") as a horizontal unit vector in the scene. */
export function directionVector(d: PlantObservation["frame"]["leanDirection"]): Vector3 {
  const toward = new Vector3(Math.sin(CAMERA_AZ), 0, Math.cos(CAMERA_AZ));
  const right = new Vector3(Math.cos(CAMERA_AZ), 0, -Math.sin(CAMERA_AZ));
  switch (d) {
    case "left": return right.negate();
    case "right": return right;
    case "toward": return toward;
    case "away": return toward.negate();
    default: return new Vector3();
  }
}

export type PlantRenderPlan = {
  mode: RenderMode;
  seed: string;
  archetype: PlantObservation["archetype"];
  /** Monstera-like aroid renderer (basal crowns, long petioles, maturity-driven fenestration). */
  monstera: boolean;
  months: number;
  state: GrowthState;
  conditions: GrowthConditions;
  heightM: number;
  canopyWidthM: number;
  maturity: number;
  stage: GrowthStage;
  /** Continuous count of leaves PRODUCED so far (new ones emerge gradually, old ones are shed). */
  leafCount: number;
  /** Leaves the plant keeps before the oldest are shed. */
  maxLeaves: number;
  /** Form maturity and blade length a leaf had when it was produced; fixed for its whole life. */
  leafAt: (index: number) => { form: number; lengthM: number };
  /** Today's photographed plant: every future is expressed relative to it. */
  today: { leafCount: number; leafLengthM: number; leafLengthMinM: number; formMaturity: number; heightM: number };
  wilt: number;
  leaf: { color: string; youngColor: string; undersideColor: string; gloss: number; widthToLength: number; droop: number; sizeVariation: number; yellowing: number; brownTips: number; variegation: Visual["leaves"]["variegation"]; variegationAmount: number; variegationColor: string; fenestrationPotential: number };
  stem: { color: string; thicknessM: number; count: number };
  /** Stems/canes/crowns as photographed, grown by the stage plan. */
  axes: { kind: PlantObservation["structure"]["axes"][number]["kind"]; heightM: number; thicknessM: number; leanRad: number; direction: Vector3 }[];
  /** Where the foliage mass sits: height as a fraction of plant height, a horizontal bias and a share. */
  clusters: { height: number; direction: Vector3; share: number }[];
  pot: { radius: number; depth: number; shape: PlantObservation["pot"]["shape"] } & Visual["pot"];
  /** Legacy adapter for the generic architectures (herb/shrub/vine/grass/tree/succulent/cactus). */
  profile: RenderProfile;
  visual: Visual;
};

const DROOP = { upright: 0.05, spreading: 0.15, arching: 0.35, drooping: 0.7 } as const;
const FORM = { aroid: "rosette", cane: "tree", herb: "upright-branching", shrub: "upright-branching", succulent: "succulent", cactus: "succulent", vine: "vine", grass: "grass", tree: "tree" } as const;
const SHAPE = { ovate: "ovate", cordate: "ovate", lanceolate: "lanceolate", strap: "lanceolate", palmate: "palmate", needle: "needle", round: "round", fenestrated: "fenestrated" } as const;

/**
 * The generic architectures still speak the older profile + visual dialect; feed them the
 * observation (not the species average) so they rebuild the photographed individual.
 */
function legacyProfile(scan: PlantScan, heightCm: number, canopyWidthCm: number): RenderProfile {
  const o = scan.observation, l = o.leaves;
  const perAxis = Math.max(1, l.count / o.structure.axes.length);
  return {
    ...scan.profile,
    morphology: {
      ...scan.profile.morphology,
      growthForm: FORM[o.archetype],
      currentHeightCm: o.frame.plantHeightCm,
      stemColor: o.colors.stem,
      leaf: { shape: SHAPE[l.shape], color: o.colors.leaf, lengthCm: Math.max(0.5, l.lengthCmMax), countNow: o.archetype === "cactus" ? 0 : l.count },
    },
    visual: {
      seed: `${scan.profile.species.scientificName}:${o.leaves.count}:${o.frame.plantHeightCm}`,
      silhouette: { widthToHeight: canopyWidthCm / heightCm, leanDeg: o.frame.leanDeg, leanDirection: o.frame.leanDirection === "center" ? "none" : o.frame.leanDirection, symmetry: o.frame.symmetry, legginess: clamp01(1 - l.density) * 0.6 },
      stems: { countFromSoil: o.structure.axes.length, thicknessMm: o.structure.axes[0].thicknessMm, internodeCm: Math.max(0.5, o.frame.plantHeightCm / (perAxis / (l.arrangement === "opposite" ? 2 : 1) + 1)) },
      leaves: {
        arrangement: l.arrangement, widthToLength: l.widthToLength, tip: l.tip === "rounded" || l.tip === "notched" ? "rounded" : "pointed",
        base: l.shape === "cordate" || l.shape === "fenestrated" ? "heart" : l.shape === "round" ? "rounded" : "tapered",
        edge: l.edge === "wavy" ? "smooth" : l.edge, fenestration: l.fenestration, variegation: l.variegation, variegationColor: o.colors.variegation,
        gloss: l.gloss, colorUnder: o.colors.underside, droop: DROOP[l.orientation], sizeVariation: l.lengthCmMax > 0 ? clamp01(1 - l.lengthCmMin / l.lengthCmMax) : 0.2,
      },
      succulent: o.succulent,
      condition: { yellowing: o.health.yellowing, brownTips: o.health.brownTips },
      pot: { material: o.pot.material === "concrete" ? "ceramic" : o.pot.material, color: o.pot.color, diameterCm: o.pot.rimDiameterCm, heightToDiameter: o.pot.heightCm / o.pot.rimDiameterCm },
    },
  };
}

export function renderPlanOf(scan: PlantScan, mode: RenderMode, months = 0, conditions = defaultConditions(scan)): PlantRenderPlan {
  const o = scan.observation;
  const t = mode === "scanned" ? 0 : months;
  const state = growthAt(scan, t, conditions);
  const profile = legacyProfile(scan, state.heightCm, state.canopyWidthCm);
  const visual = visualOf(profile);
  const count0 = Math.max(1, o.leaves.count);
  const monstera = o.archetype === "aroid";
  // Aroid leaf form: what the photographed leaves show (their splits), then what the stages add.
  const formOf = (fenestration: number, maturity: number) => Math.max(smoothstep(0, 0.85, fenestration), maturity * 0.6);
  const formToday = formOf(o.leaves.fenestration, o.maturity * (o.leaves.fenestration > 0.05 ? 1 : 0.4));
  const lenMax = Math.max(0.005, o.leaves.lengthCmMax / 100), lenMin = Math.min(lenMax, Math.max(0.003, o.leaves.lengthCmMin / 100));
  // The reference/stages count leaves a plant keeps; it produces more and sheds the oldest.
  const PRODUCED_PER_KEPT = 1.6;
  const produced = (leaves: number) => count0 + Math.max(0, leaves - count0) * PRODUCED_PER_KEPT;
  const born = new Map<number, { form: number; lengthM: number }>();
  const leafAt = (i: number) => {
    let hit = born.get(i);
    if (hit) return hit;
    if (i < count0) {
      // Photographed leaves span the observed size range; the oldest are smaller and more juvenile.
      const age = count0 > 1 ? (count0 - 1 - i) / (count0 - 1) : 0;
      // Most photographed leaves are near the largest size; only the few oldest shrink toward the minimum.
      hit = { form: clamp01(formToday - age * 0.3), lengthM: lenMax - (lenMax - lenMin) * age ** 2.5 };
    } else {
      // A future leaf takes the form and size of the stage in which the plant produces it.
      let lo = 0, hi = 240;
      for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (produced(growthAt(scan, mid, conditions).leaves) < i + 1) lo = mid; else hi = mid; }
      const s = growthAt(scan, hi, conditions);
      hit = { form: Math.max(formToday, formOf(s.fenestration, s.maturity)), lengthM: Math.max(lenMax, s.leafLengthCm / 100) };
    }
    born.set(i, hit);
    return hit;
  };
  const growth = state.heightCm / o.frame.plantHeightCm;
  const potScale = conditions.potDiameterCm / o.pot.rimDiameterCm;
  return {
    mode, seed: visual.seed, archetype: o.archetype, monstera, months: t, state, conditions,
    heightM: state.heightCm / 100, canopyWidthM: state.canopyWidthCm / 100, maturity: state.maturity, stage: state.stage,
    leafCount: monstera ? produced(state.leaves) : state.leaves, maxLeaves: monstera ? Math.max(count0, state.leaves) : Infinity, leafAt,
    today: { leafCount: count0, leafLengthM: lenMax, leafLengthMinM: lenMin, formMaturity: formToday, heightM: o.frame.plantHeightCm / 100 },
    wilt: state.wilt,
    leaf: {
      color: o.colors.leaf, youngColor: o.colors.leafYoung, undersideColor: o.colors.underside, gloss: o.leaves.gloss, widthToLength: o.leaves.widthToLength,
      droop: DROOP[o.leaves.orientation], sizeVariation: visual.leaves.sizeVariation, yellowing: o.health.yellowing, brownTips: o.health.brownTips,
      variegation: visual.leaves.variegation, variegationAmount: visual.leaves.variegationAmount, variegationColor: o.colors.variegation,
      fenestrationPotential: monstera ? Math.max(0.8, o.leaves.fenestration) : o.leaves.fenestration,
    },
    stem: { color: o.colors.stem, thicknessM: o.structure.axes[0].thicknessMm / 1000, count: Math.max(o.structure.axes.length, Math.round(state.axes)) },
    axes: o.structure.axes.map(a => ({ kind: a.kind, heightM: a.heightCm / 100 * growth, thicknessM: a.thicknessMm / 1000 * Math.sqrt(growth), leanRad: a.leanDeg * Math.PI / 180, direction: directionVector(a.direction) })),
    clusters: o.structure.leafClusters.map(c => ({ height: c.height, direction: directionVector(c.direction), share: c.share })),
    pot: { ...visual.pot, shape: o.pot.shape, material: o.pot.visible ? visual.pot.material : "none", radius: conditions.potDiameterCm / 200, depth: o.pot.heightCm / 100 * potScale },
    profile, visual,
  };
}
