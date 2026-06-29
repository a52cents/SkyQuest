type VisibilityBadgeProps = {
  label: string;
  score: number;
};

export function VisibilityBadge({ label, score }: VisibilityBadgeProps) {
  const tone = score >= 80 ? "text-[#63e6a4] bg-[#63e6a4]/12 border-[#63e6a4]/25" :
    score >= 60 ? "text-[#38d5ff] bg-[#38d5ff]/12 border-[#38d5ff]/25" :
    score >= 40 ? "text-[#ffd166] bg-[#ffd166]/12 border-[#ffd166]/25" :
    "text-[#ff9bb0] bg-[#ff6b8a]/12 border-[#ff6b8a]/25";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${tone}`}>
      {label} · {score}
    </span>
  );
}
