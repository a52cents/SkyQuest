"use client";

import { useState } from "react";
import { haptic } from "@/lib/haptics";
import {
  createObservationReport,
  getObservationReportLabel,
  MISSED_REPORT_OPTIONS,
  SEEN_REPORT_OPTIONS,
} from "@/lib/observation-report";
import { updateObservationReport } from "@/lib/storage";
import type { Observation, ObservationReportValue } from "@/lib/types";

export function ObservationReportPicker({
  observation,
  onUpdated,
}: {
  observation: Observation;
  onUpdated?: (observation: Observation) => void;
}) {
  const [current, setCurrent] = useState(observation);
  const [message, setMessage] = useState<string | null>(null);
  const options = current.status === "seen" ? SEEN_REPORT_OPTIONS : MISSED_REPORT_OPTIONS;
  const isFreeObservation = current.targetType === "free_observation";

  async function select(value: ObservationReportValue) {
    const report = createObservationReport(current, value);
    if (!report) return;
    const updated = await updateObservationReport(current.id, report);
    if (!updated) return;
    setCurrent(updated);
    onUpdated?.(updated);
    haptic("select");
    setMessage("Compte rendu enregistré.");
  }

  return (
    <section className="mt-4 border-t border-white/[0.07] pt-4" aria-label="Compte rendu">
      <p className="text-sm font-semibold text-text">
        {isFreeObservation
          ? current.status === "seen"
            ? "Qu’as-tu remarqué ?"
            : "Qu’est-ce qui a gêné ton observation ?"
          : current.status === "seen"
            ? "Un détail à retenir ?"
            : "Qu’est-ce qui t’a gêné ?"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = current.observationReport?.value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => void select(option.value)}
              className={`min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors ${
                selected
                  ? "border-accent bg-accent text-white"
                  : "border-white/[0.1] bg-white/[0.03] text-muted"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {message || current.observationReport ? (
        <p className="mt-2 text-xs text-accent-cyan" role="status">
          {message ?? getObservationReportLabel(current.observationReport)}
        </p>
      ) : null}
    </section>
  );
}
