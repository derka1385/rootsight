# Surface textures (optional)

The renderer draws every surface procedurally, so this folder can stay empty.
Drop in scanned or hand-made PBR maps to replace a procedural surface, then list
them in `web/public/assets.json`. Unlisted files are never requested.

```json
{
  "surfaces": {
    "terracotta": { "albedo": "materials/terracotta/albedo.webp", "normal": "materials/terracotta/normal.webp", "roughness": "materials/terracotta/roughness.webp", "repeat": 2 }
  },
  "environment": null
}
```

Surfaces: `terracotta`, `ceramic`, `plastic` (pot wall) and `soil` (soil top and section).

| Slot | Colour space | Channel use |
| --- | --- | --- |
| `albedo` | sRGB | base colour, multiplied by the photographed pot colour, so keep it near-white/neutral for pots |
| `normal` | linear | OpenGL convention (+Y up) tangent-space normal |
| `roughness` | linear | green channel (glTF ORM layout also works) |
| `alpha` | linear | green channel, cut-out at 0.5 |
| `displacement` | linear | reserved; not used by the realtime renderer (no tessellation on mobile) |

Leaves are not in this list on purpose: each plant's blades are painted at runtime so
their splits and holes match its maturity and venation (`web/src/three/leafSystem.ts`).

Only use textures you have the rights to (your own photos/scans or CC0 sources such as
ambientCG or Poly Haven), and keep each map at 1024 px or less for phones.
