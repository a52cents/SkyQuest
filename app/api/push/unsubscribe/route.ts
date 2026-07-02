import { NextResponse } from "next/server";
import { deletePushSubscription } from "@/lib/push-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let endpoint: unknown;
  try {
    endpoint = ((await request.json()) as { endpoint?: unknown }).endpoint;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (typeof endpoint !== "string" || endpoint.length > 2_048) {
    return NextResponse.json({ error: "Endpoint invalide." }, { status: 400 });
  }

  try {
    await deletePushSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Stockage push indisponible." }, { status: 503 });
  }
}
