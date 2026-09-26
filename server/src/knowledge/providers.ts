import type Anthropic from "@anthropic-ai/sdk";
import { SpeciesKnowledge, type KnowledgeSource, type PlantIdentity } from "@rootsight/shared/schema";
import { librarySpecies } from "@rootsight/shared/species";
import { askJson } from "../claude";
import { NORMALIZE_PROMPT } from "../prompts";

/** Raw reference material about a species: facts to read and photos to look at. */
/** Images are downloaded by the server (Wikimedia refuses most bots, Claude's URL fetcher included). */
export type References = { text: { title: string; body: string; source: KnowledgeSource }[]; images: { data: string; mediaType: "image/jpeg" | "image/png"; source: KnowledgeSource }[] };

/** A source of species knowledge: either finished structured knowledge, or raw references. */
export interface SpeciesKnowledgeProvider {
  readonly name: string;
  knowledge?(id: PlantIdentity): Promise<SpeciesKnowledge | null>;
  references?(id: PlantIdentity): Promise<Partial<References>>;
}

const UA = { "User-Agent": "Rootsight/1.0 (plant visualization; https://github.com/derka1385/rootsight)" };
const TIMEOUT = 6000;

/** Curated priors shipped with the app (shared/species/library.ts). Instant, offline, trusted. */
export class StaticSpeciesLibraryProvider implements SpeciesKnowledgeProvider {
  readonly name = "library";
  async knowledge(id: PlantIdentity) {
    return librarySpecies(id.scientificName, id.aliases);
  }
}

/** Plain-text species article from Wikipedia, focused on the Description section. */
export class WikipediaProvider implements SpeciesKnowledgeProvider {
  readonly name = "wikipedia";
  async references(id: PlantIdentity): Promise<Partial<References>> {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&format=json&titles=${encodeURIComponent(id.scientificName)}`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
    const json = (await res.json()) as { query?: { pages?: Record<string, { title?: string; extract?: string; missing?: string }> } };
    const page = Object.values(json.query?.pages ?? {})[0];
    if (!page?.extract || page.missing !== undefined) return {};
    const text = page.extract;
    // The intro plus the Description section carry the morphology; the rest is mostly history and uses.
    const intro = text.split(/\n==/)[0];
    const desc = text.match(/== ?Description ?==([\s\S]*?)(\n== [^=]|$)/)?.[1] ?? "";
    const title = page.title ?? id.scientificName;
    return { text: [{ title, body: `${intro}\n${desc}`.slice(0, 7000), source: { provider: "wikipedia", title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, license: "CC BY-SA 4.0" } }] };
  }
}

/** Photos of the species on Wikimedia Commons (URLs only, never stored), for visual reference. */
export class WikimediaCommonsProvider implements SpeciesKnowledgeProvider {
  readonly name = "wikimedia-commons";
  async references(id: PlantIdentity): Promise<Partial<References>> {
    const q = encodeURIComponent(`${id.scientificName} filetype:bitmap`);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
    type Info = { thumburl?: string; descriptionurl?: string; extmetadata?: { LicenseShortName?: { value?: string } } };
    const json = (await res.json()) as { query?: { pages?: Record<string, { title: string; imageinfo?: Info[] }> } };
    const picks = Object.values(json.query?.pages ?? {})
      .flatMap(p => (p.imageinfo?.[0]?.thumburl ? [{ p, info: p.imageinfo[0] }] : []))
      .filter(({ info }) => /\.(jpe?g|png)/i.test(info.thumburl!))
      .slice(0, 3);
    const images = await Promise.all(picks.map(async ({ p, info }) => {
      const img = await fetch(info.thumburl!.split("?")[0], { headers: UA, signal: AbortSignal.timeout(TIMEOUT) });
      if (!img.ok) return null;
      const mediaType = /\.png$/i.test(info.thumburl!.split("?")[0]) ? "image/png" as const : "image/jpeg" as const;
      return { data: Buffer.from(await img.arrayBuffer()).toString("base64"), mediaType, source: { provider: "wikimedia-commons" as const, title: p.title, url: info.descriptionurl, license: info.extmetadata?.LicenseShortName?.value } };
    }));
    return { images: images.filter((x) => x !== null) };
  }
}

/** Claude reads the references (and looks at the reference photos) and writes structured knowledge. */
export class AnthropicNormalizationProvider {
  readonly name = "claude";
  async normalize(id: PlantIdentity, refs: References): Promise<SpeciesKnowledge> {
    try {
      return await this.ask(id, refs);
    } catch (e) {
      // A reference photo the API rejects should not cost us the text references.
      if (!refs.images.length || !refs.text.length) throw e;
      console.warn(`[knowledge] normalising with photos failed (${(e as Error).message.slice(0, 120)}), retrying text-only`);
      return this.ask(id, { ...refs, images: [] });
    }
  }

  private async ask(id: PlantIdentity, refs: References): Promise<SpeciesKnowledge> {
    const content: Anthropic.ContentBlockParam[] = [
      { type: "text", text: `Species: ${id.scientificName} (${id.commonName}, family ${id.family}).` },
      ...refs.text.map((t): Anthropic.ContentBlockParam => ({ type: "text", text: `Reference text from ${t.source.provider} "${t.title}":\n${t.body}` })),
      ...refs.images.flatMap((im, i): Anthropic.ContentBlockParam[] => [
        { type: "text", text: `Reference photo ${i + 1} (${im.source.title}):` },
        { type: "image", source: { type: "base64", media_type: im.mediaType, data: im.data } },
      ]),
    ];
    const out = await askJson(SpeciesKnowledge.omit({ sources: true }), NORMALIZE_PROMPT, content, "low");
    return SpeciesKnowledge.parse({ ...out, scientificName: id.scientificName, sources: [...refs.text.map(t => t.source), ...refs.images.map(i => i.source), { provider: "claude", title: "Normalised by Claude from the references above" }] });
  }
}
