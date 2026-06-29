import { VisibilityBadge } from "@/components/VisibilityBadge";
import type { SkyQuest, SkyObjectName } from "@/lib/types";

type QuestCardProps = {
  quest: SkyQuest;
  onStart: (quest: SkyQuest) => void;
  onSeen: (quest: SkyQuest) => void;
  onMissed: (quest: SkyQuest) => void;
};

const icons: Record<SkyObjectName | "FreeObservation" | "SunTest", string> = {
  Moon: "🌙",
  Venus: "✦",
  Jupiter: "◉",
  Saturn: "◎",
  Mars: "•",
  FreeObservation: "✧",
  SunTest: "☼",
};

export function QuestCard({ quest, onStart, onSeen, onMissed }: QuestCardProps) {
  return (
    <article className="glass-card overflow-hidden rounded-[28px] p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.07] text-2xl">
          {icons[quest.target]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <VisibilityBadge label={quest.visibilityLabel} score={quest.visibilityScore} />
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm font-semibold text-[#cbd0ff]">
              {quest.difficulty === "easy" ? "Facile" : "Moyen"}
            </span>
          </div>
          <h3 className="mt-3 text-2xl font-extrabold tracking-[-0.03em] text-white">{quest.title}</h3>
          <p className="mt-2 text-base leading-6 text-[#c5caf5]">{quest.description}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-[22px] border border-white/10 bg-[#070816]/35 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7d84b8]">Direction</p>
          <p className="mt-1 text-lg font-bold text-white">{quest.cardinalDirection ?? "Libre"}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7d84b8]">Hauteur</p>
          <p className="mt-1 text-lg font-bold text-white">
            {quest.altitude !== null ? `${Math.round(quest.altitude)}° au-dessus de l'horizon` : "À ton rythme"}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-[20px] bg-[#7c5cff]/10 p-4 text-sm leading-6 text-[#d9dcff]">{quest.tip}</p>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          onClick={() => onStart(quest)}
          className="min-h-14 rounded-full bg-[#7c5cff] px-5 text-base font-extrabold text-white shadow-[0_16px_40px_rgba(124,92,255,0.35)] transition active:scale-[0.98]"
        >
          Commencer
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSeen(quest)}
            className="min-h-12 rounded-full border border-[#63e6a4]/25 bg-[#63e6a4]/12 px-4 text-sm font-bold text-[#9df0c4] transition active:scale-[0.98]"
          >
            Je l&apos;ai vu
          </button>
          <button
            type="button"
            onClick={() => onMissed(quest)}
            className="min-h-12 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            Pas trouvé
          </button>
        </div>
      </div>
    </article>
  );
}
