import { formatZoom } from "./camera-utils";
import type { CameraZoomRange } from "./types";

type CameraZoomControlProps = {
  range: CameraZoomRange;
  value: number;
  onChange: (value: number) => void;
};

export function CameraZoomControl({ range, value, onChange }: CameraZoomControlProps) {
  return (
    <label className="block rounded-[13px] border border-white/[0.08] bg-white/[0.05] p-3">
      <span className="flex items-center justify-between gap-3 text-sm font-bold text-white">
        Zoom <span className="text-accent-cyan">{formatZoom(value)}x</span>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-0 w-full touch-manipulation accent-[var(--accent-cyan)]"
      />
    </label>
  );
}
