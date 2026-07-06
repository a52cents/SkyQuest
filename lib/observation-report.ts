import type {
  MissedObservationReportValue,
  Observation,
  ObservationReport,
  ObservationReportValue,
  SeenObservationReportValue,
} from "@/lib/types";

export const SEEN_REPORT_OPTIONS = [
  { value: "bright", label: "Très brillante" },
  { value: "faint", label: "Faible" },
  { value: "color_noticed", label: "Couleur remarquée" },
  { value: "shape_recognized", label: "Forme reconnue" },
  { value: "movement_seen", label: "Mouvement observé" },
] as const;

export const MISSED_REPORT_OPTIONS = [
  { value: "clouds", label: "Nuages" },
  { value: "blocked_horizon", label: "Horizon masqué" },
  { value: "uncertain_direction", label: "Direction incertaine" },
  { value: "too_faint", label: "Cible trop faible" },
  { value: "not_enough_time", label: "Pas assez de temps" },
] as const;

export function getObservationReportLabel(report: ObservationReport | undefined): string | null {
  if (!report) return null;
  const options = report.kind === "seen_detail" ? SEEN_REPORT_OPTIONS : MISSED_REPORT_OPTIONS;
  return options.find((option) => option.value === report.value)?.label ?? null;
}

export function createObservationReport(
  observation: Observation,
  value: ObservationReportValue,
  now = new Date(),
): ObservationReport | null {
  if (observation.status === "seen" && SEEN_REPORT_OPTIONS.some((item) => item.value === value)) {
    return {
      kind: "seen_detail",
      value: value as SeenObservationReportValue,
      recordedAt: now.toISOString(),
    };
  }
  if (
    observation.status === "missed" &&
    MISSED_REPORT_OPTIONS.some((item) => item.value === value)
  ) {
    return {
      kind: "missed_reason",
      value: value as MissedObservationReportValue,
      recordedAt: now.toISOString(),
    };
  }
  return null;
}
