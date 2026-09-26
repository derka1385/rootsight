import { useEffect, useState } from "react";
import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";

/** Optional real textures listed in web/public/assets.json (see web/public/materials/README.md). */
export type SurfaceName = "terracotta" | "ceramic" | "plastic" | "soil";
type Slot = "albedo" | "normal" | "roughness" | "alpha";
type Manifest = { surfaces?: Partial<Record<SurfaceName, Partial<Record<Slot, string>> & { repeat?: number }>>; environment?: string | null };
export type SurfaceMaps = Partial<Record<Slot, Texture>>;

let manifest: Promise<Manifest> | undefined;
const loadManifest = () => (manifest ??= fetch(`${import.meta.env.BASE_URL}assets.json`).then((r): Promise<Manifest> | Manifest => (r.ok ? r.json() : {})).catch((): Manifest => ({})));
const cache = new Map<string, Promise<SurfaceMaps>>();

function loadSurface(name: SurfaceName): Promise<SurfaceMaps> {
  let hit = cache.get(name);
  if (!hit) {
    hit = loadManifest().then(async m => {
      const entry = m.surfaces?.[name];
      if (!entry) return {};
      const loader = new TextureLoader();
      const maps: SurfaceMaps = {};
      await Promise.all((["albedo", "normal", "roughness", "alpha"] as const).map(async slot => {
        const url = entry[slot];
        if (!url) return;
        const t = await loader.loadAsync(`${import.meta.env.BASE_URL}${url}`).catch(() => null);
        if (!t) return;
        if (slot === "albedo") t.colorSpace = SRGBColorSpace;
        t.wrapS = t.wrapT = RepeatWrapping;
        t.repeat.setScalar(entry.repeat ?? 1);
        t.anisotropy = 4;
        maps[slot] = t;
      }));
      return maps;
    });
    cache.set(name, hit);
  }
  return hit;
}

/** Maps for a surface, or null while loading / when none are listed (callers keep procedural maps). */
export function useSurfaceMaps(name: SurfaceName): SurfaceMaps | null {
  const [maps, setMaps] = useState<SurfaceMaps | null>(null);
  useEffect(() => {
    let live = true;
    loadSurface(name).then(m => { if (live) setMaps(Object.keys(m).length ? m : null); });
    return () => { live = false; };
  }, [name]);
  return maps;
}

/** Optional HDRI path for reflections, or null to keep the in-scene Lightformers. */
export function useEnvironmentFile(): string | null {
  const [file, setFile] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadManifest().then(m => { if (live && m.environment) setFile(`${import.meta.env.BASE_URL}${m.environment}`); });
    return () => { live = false; };
  }, []);
  return file;
}
