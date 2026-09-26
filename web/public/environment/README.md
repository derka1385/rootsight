# Environment lighting (optional)

By default the scene lights itself with in-scene Lightformers (no download).
To use an HDRI instead, put an equirectangular `.hdr` (1k is plenty) here and set
`"environment": "environment/studio.hdr"` in `web/public/assets.json`.
It is used for reflections only; the backdrop stays the neutral studio gradient.
Use CC0 HDRIs (e.g. Poly Haven) or your own.

## Included

- `studio.hdr` — "Brown Photostudio 02" by Poly Haven (CC0), https://polyhaven.com/a/brown_photostudio_02, 1k.
