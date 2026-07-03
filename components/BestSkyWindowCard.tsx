import Link from "next/link";
import { getAppCardClassName } from "@/components/AppCard";
import type { BestSkyWindow } from "@/lib/types";

function formatTime(date: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone === "auto" ? undefined : timezone,
    }).format(new Date(date));
  } catch {
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(date),
    );
  }
}

export function BestSkyWindowCard({ window }: { window: BestSkyWindow | null }) {
  const reliable = window && window.score >= 50;
  return (
    <Link
      href="/tonight"
      className={getAppCardClassName({
        variant: "solid",
        className: "best-window-card",
      })}
      aria-label="Voir le meilleur créneau du soir"
    >
      <div className="best-window-orbit" aria-hidden="true">
        <span />
      </div>
      <div className="best-window-kicker">Meilleur créneau</div>
      {window ? (
        <>
          <h2>
            {reliable ? "Ce soir" : "Ciel difficile"}{" "}
            <strong>
              {formatTime(window.startsAt, window.timezone)}–
              {formatTime(window.endsAt, window.timezone)}
            </strong>
          </h2>
          <p>
            {reliable
              ? "C’est le moment le plus prometteur."
              : "C’est le moment le moins défavorable."}
            {window.bestTargets.length
              ? ` À tenter : ${window.bestTargets.join(", ")}.`
              : " Observation libre conseillée."}
          </p>
        </>
      ) : (
        <>
          <h2>Quand sortir ce soir ?</h2>
          <p>Une réponse simple sur les prochaines 24 heures, météo et ciel réunis.</p>
        </>
      )}
      <span className="best-window-link">Voir les prochaines heures →</span>
    </Link>
  );
}
