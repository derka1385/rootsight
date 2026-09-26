import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SpeciesKnowledge } from "@rootsight/shared/schema";

/**
 * Species knowledge cache: memory first, then one JSON file per species under server/.cache/species
 * (gitignored). Live enrichment takes two web fetches and a Claude call; a species is only enriched once.
 */
const DIR = join(import.meta.dirname, "..", "..", ".cache", "species");
const memory = new Map<string, SpeciesKnowledge>();
export const slug = (scientificName: string) => scientificName.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");

export async function cached(scientificName: string): Promise<SpeciesKnowledge | null> {
  const key = slug(scientificName);
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const parsed = SpeciesKnowledge.safeParse(JSON.parse(await readFile(join(DIR, `${key}.json`), "utf8")));
    if (parsed.success) { memory.set(key, parsed.data); return parsed.data; }
  } catch {}
  return null;
}

export async function remember(k: SpeciesKnowledge): Promise<void> {
  const key = slug(k.scientificName);
  memory.set(key, k);
  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(join(DIR, `${key}.json`), JSON.stringify(k, null, 2));
  } catch (e) {
    console.warn(`[knowledge] could not persist ${key}: ${(e as Error).message}`);
  }
}

/** Tests only. */
export const forgetAll = () => memory.clear();
