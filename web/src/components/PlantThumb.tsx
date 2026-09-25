import type { PlantProfile } from "@rootsight/shared/schema";
import { archetypeOf } from "../three/Plant";

/**
 * Lightweight illustrated thumbnail (SVG, no WebGL): a terracotta pot and the plant's silhouette in
 * its own colours. One 3D canvas per card would be too heavy for a list on a phone.
 */
export default function PlantThumb({ profile, className }: { profile: PlantProfile; className?: string }) {
  const { leaf, stemColor } = profile.morphology;
  const kind = archetypeOf(profile);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <ellipse cx="50" cy="93" rx="24" ry="3.5" fill="rgba(60,40,20,.15)" />
      {kind === "cactus" && (
        <g>
          <ellipse cx="50" cy="58" rx="22" ry="20" fill={stemColor} />
          {[-16, -8, 0, 8, 16].map((x) => (
            <path key={x} d={`M${50 + x} 40 Q${50 + x * 1.35} 58 ${50 + x} 76`} stroke="rgba(0,0,0,.18)" strokeWidth="1.6" fill="none" />
          ))}
          {[-18, -10, -2, 6, 14].flatMap((x) => [46, 56, 66].map((y) => <circle key={`${x}${y}`} cx={50 + x + 2} cy={y} r="1.1" fill={leaf.color} />))}
        </g>
      )}
      {kind === "rosette" && (
        <g>
          {[-58, -30, -4, 22, 50].map((a, i) => (
            <g key={a} transform={`rotate(${a} 50 70)`}>
              <path d={`M50 70 Q${50 + (i % 2 ? 4 : -4)} 50 50 ${34 - (i % 3) * 4}`} stroke={stemColor} strokeWidth="1.6" fill="none" />
              <path d={`M50 ${34 - (i % 3) * 4} c-12 -2 -14 -16 0 -20 c14 4 12 18 0 20Z`} fill={leaf.color} opacity={0.85 + (i % 2) * 0.15} />
            </g>
          ))}
        </g>
      )}
      {kind === "branching" && (
        <g>
          <path d="M50 72 V22" stroke={stemColor} strokeWidth="2" />
          <path d="M50 52 Q40 44 36 34 M50 44 Q61 36 64 26" stroke={stemColor} strokeWidth="1.5" fill="none" />
          {[[50, 62], [50, 50], [50, 38], [36, 34], [64, 26], [50, 26]].flatMap(([x, y], i) =>
            [-1, 1].map((s) => <ellipse key={`${i}${s}`} cx={x + s * 6} cy={y} rx="6" ry="3.4" transform={`rotate(${s * -25} ${x + s * 6} ${y})`} fill={leaf.color} opacity={0.8 + (i % 2) * 0.2} />),
          )}
        </g>
      )}
      <path d="M31 70 H69 L64 92 H36 Z" fill="#c0673f" />
      <rect x="28" y="66" width="44" height="7" rx="2.5" fill="#cf7a52" />
    </svg>
  );
}
