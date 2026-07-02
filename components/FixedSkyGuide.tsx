import { getSkyFigure, type SkyFigure } from "@/lib/constellation-figures";

type FixedSkyGuideProps = {
  targetId: string;
  hasPrecisePoint: boolean;
  aligned: boolean;
};

type GuidePoint = { x: number; y: number; magnitude?: number };

// The square guide represents roughly 45° of sky. Keeping one shared angular
// scale prevents compact targets such as the Pleiades from looking as large as
// the Great Bear or the Summer Triangle.
const SVG_UNITS_PER_DEGREE = 80 / 45;

function projectFigure(figure: SkyFigure): Map<string, GuidePoint> {
  const referenceRightAscension = figure.stars[0]?.rightAscensionHours ?? 0;
  const meanDeclination =
    figure.stars.reduce((total, star) => total + star.declinationDegrees, 0) /
    Math.max(1, figure.stars.length);
  const cosineDeclination = Math.cos((meanDeclination * Math.PI) / 180);
  const rawPoints = figure.stars.map((star) => {
    const wrappedHours =
      ((((star.rightAscensionHours - referenceRightAscension + 12) % 24) + 24) % 24) - 12;
    return {
      id: star.id,
      x: wrappedHours * 15 * cosineDeclination,
      y: -star.declinationDegrees,
      magnitude: star.magnitude,
    };
  });
  const minX = Math.min(...rawPoints.map((point) => point.x));
  const maxX = Math.max(...rawPoints.map((point) => point.x));
  const minY = Math.min(...rawPoints.map((point) => point.y));
  const maxY = Math.max(...rawPoints.map((point) => point.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return new Map(
    rawPoints.map((point) => [
      point.id,
      {
        x: 50 + (point.x - centerX) * SVG_UNITS_PER_DEGREE,
        y: 50 + (point.y - centerY) * SVG_UNITS_PER_DEGREE,
        magnitude: point.magnitude,
      },
    ]),
  );
}

export function FixedSkyGuide({ targetId, hasPrecisePoint, aligned }: FixedSkyGuideProps) {
  const figure = getSkyFigure(targetId);
  const tone = aligned ? "text-success" : "text-accent-cyan";

  if (!figure) {
    return (
      <div
        aria-label="Viseur céleste fixe"
        className={`relative flex h-28 w-28 items-center justify-center rounded-full border bg-current/10 ${aligned ? "border-success/80 text-success" : "border-accent-cyan/70 text-accent-cyan"}`}
      >
        <div className="absolute h-px w-24 bg-white/28" />
        <div className="absolute h-24 w-px bg-white/28" />
        {hasPrecisePoint ? <div className="h-3 w-3 rounded-full bg-current" /> : null}
      </div>
    );
  }

  const points = projectFigure(figure);
  return (
    <div
      role="img"
      aria-label={`Repère fixe de ${figure.name}`}
      className={`h-40 w-52 rounded-[28px] border bg-[#0a0a0b]/55 p-3 shadow-[0_0_55px_color-mix(in_srgb,var(--accent-cyan)_18%,transparent)] backdrop-blur-sm ${aligned ? "border-success/70" : "border-accent-cyan/55"}`}
    >
      <svg viewBox="0 0 100 100" className={`h-full w-full ${tone}`} aria-hidden="true">
        {figure.segments.map(([fromId, toId]) => {
          const from = points.get(fromId);
          const to = points.get(toId);
          return from && to ? (
            <line
              key={`${fromId}-${toId}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.82"
            />
          ) : null;
        })}
        {[...points.entries()].map(([id, point]) => (
          <circle
            key={id}
            cx={point.x}
            cy={point.y}
            r={Math.max(1.7, 4.3 - (point.magnitude ?? 3) * 0.55)}
            fill="currentColor"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="0.6"
          />
        ))}
      </svg>
    </div>
  );
}
