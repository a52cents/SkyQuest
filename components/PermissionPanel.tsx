const permissions = [
  { label: "Position", text: "pour adapter le ciel à ton lieu" },
  { label: "Caméra", text: "pour le guidage 2D" },
  { label: "Orientation", text: "pour indiquer où tourner" },
];

export function PermissionPanel() {
  return (
    <div className="glass-card mt-5 rounded-[28px] p-4">
      <p className="text-sm font-semibold text-white">Permissions utiles</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {permissions.map((permission) => (
          <div key={permission.label} className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
            <p className="text-sm font-bold text-white">{permission.label}</p>
            <p className="mt-1 text-sm leading-5 text-[#aeb5e8]">{permission.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
