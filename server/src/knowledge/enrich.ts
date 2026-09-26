import type { PlantIdentification, SpeciesKnowledge } from "@rootsight/shared/schema";
import { genericKnowledge } from "@rootsight/shared/knowledge";
import { cached, remember } from "./cache";
import { AnthropicNormalizationProvider, StaticSpeciesLibraryProvider, WikimediaCommonsProvider, WikipediaProvider, type References, type SpeciesKnowledgeProvider } from "./providers";

export type EnrichOptions = { live: boolean; providers?: SpeciesKnowledgeProvider[]; normalizer?: Pick<AnthropicNormalizationProvider, "normalize"> };
export type Enriched = { knowledge: SpeciesKnowledge; via: "cache" | "library" | "live" | "generic"; ms: number };

const defaults = () => ({ library: new StaticSpeciesLibraryProvider(), references: [new WikipediaProvider(), new WikimediaCommonsProvider()], normalizer: new AnthropicNormalizationProvider() });

/**
 * Species knowledge for an identified plant, most trusted first:
 *   cache -> curated library -> live references (Wikipedia text + Commons photos) normalised by Claude
 *   -> generic archetype prior. Live enrichment is optional (off in mock mode) and every failure
 *   falls through to the next step, so analysis never fails because the web did.
 */
export async function enrichSpeciesKnowledge(id: PlantIdentification, opts: EnrichOptions): Promise<Enriched> {
  const t0 = Date.now(), done = (knowledge: SpeciesKnowledge, via: Enriched["via"]) => ({ knowledge, via, ms: Date.now() - t0 });
  const d = defaults();
  const name = id.identity.scientificName;
  const hit = await cached(name);
  if (hit) return done(hit, "cache");
  const curated = await d.library.knowledge(id.identity);
  if (curated) return done(curated, "library");
  if (opts.live) {
    try {
      const providers = opts.providers ?? d.references;
      const results = await Promise.allSettled(providers.map((p): Promise<Partial<References>> => p.references?.(id.identity) ?? Promise.resolve({})));
      const refs: References = { text: [], images: [] };
      results.forEach((r, i) => {
        if (r.status === "fulfilled") { refs.text.push(...(r.value.text ?? [])); refs.images.push(...(r.value.images ?? [])); }
        else console.warn(`[knowledge] ${providers[i].name} failed for ${name}: ${(r.reason as Error).message}`);
      });
      if (refs.text.length || refs.images.length) {
        const knowledge = await (opts.normalizer ?? d.normalizer).normalize(id.identity, refs);
        await remember(knowledge);
        return done(knowledge, "live");
      }
    } catch (e) {
      console.warn(`[knowledge] live enrichment failed for ${name}: ${(e as Error).message}`);
    }
  }
  return done(genericKnowledge(id), "generic");
}
