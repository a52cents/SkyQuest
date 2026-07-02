import { AppCard } from "@/components/AppCard";

const permissions = [
  { label: "Position", text: "pour adapter le ciel à ton lieu" },
  { label: "Caméra", text: "pour le guidage 2D" },
  { label: "Orientation", text: "pour indiquer où tourner" },
];

export function PermissionPanel() {
  return (
    <AppCard variant="subtle" className="mt-4 rounded-[20px]" padding="sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-text">Accès utilisés à la demande</p>
        <span className="text-xs text-faint">Rien en arrière-plan</span>
      </div>
      <div className="mt-3 grid divide-y divide-white/[0.07] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {permissions.map((permission) => (
          <div
            key={permission.label}
            className="py-3 first:pt-0 last:pb-0 sm:px-3 sm:py-0 sm:first:pl-0 sm:last:pr-0"
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-faint">
              {permission.label}
            </p>
            <p className="mt-1 text-sm leading-5 text-muted">{permission.text}</p>
          </div>
        ))}
      </div>
    </AppCard>
  );
}
