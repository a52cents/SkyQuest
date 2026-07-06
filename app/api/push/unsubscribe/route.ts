import { NextResponse } from "next/server";
import { getPushManagementTokenHash } from "@/lib/push-management-server";
import { disablePushSubscriptionByManagementTokenHash } from "@/lib/push-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const managementTokenHash = getPushManagementTokenHash(request);
  if (!managementTokenHash) {
    return NextResponse.json({ error: "Jeton de gestion requis." }, { status: 401 });
  }

  try {
    const disabled = await disablePushSubscriptionByManagementTokenHash(managementTokenHash);
    if (!disabled) return NextResponse.json({ error: "Abonnement introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }
}
