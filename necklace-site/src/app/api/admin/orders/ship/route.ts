import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import {
  carrierLabel,
  markOrderShipped,
  trackingUrl,
  type Carrier,
} from "@/lib/orders";
import { sendShipmentNotificationToCustomer } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CARRIERS: Carrier[] = [
  "japanpost_clickpost",
  "japanpost_yupacket",
  "japanpost_yupack",
  "japanpost_letter",
  "yamato",
  "sagawa",
  "other",
];

type ShipRequest = {
  sessionId?: unknown;
  carrier?: unknown;
  trackingNumber?: unknown;
};

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ShipRequest;
  try {
    body = (await req.json()) as ShipRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (typeof body.sessionId !== "string" || !body.sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
  }

  let carrier: Carrier | undefined;
  if (body.carrier != null) {
    if (typeof body.carrier !== "string" || !VALID_CARRIERS.includes(body.carrier as Carrier)) {
      return NextResponse.json({ error: "invalid carrier" }, { status: 400 });
    }
    carrier = body.carrier as Carrier;
  }

  let trackingNumber: string | undefined;
  if (body.trackingNumber != null) {
    if (typeof body.trackingNumber !== "string") {
      return NextResponse.json({ error: "invalid trackingNumber" }, { status: 400 });
    }
    const trimmed = body.trackingNumber.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > 64) {
        return NextResponse.json({ error: "trackingNumber too long" }, { status: 400 });
      }
      trackingNumber = trimmed;
    }
  }

  const updated = await markOrderShipped({
    sessionId: body.sessionId,
    carrier,
    trackingNumber,
  });

  if (!updated) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  if (updated.email) {
    await sendShipmentNotificationToCustomer({
      email: updated.email,
      customerName: updated.customerName,
      sessionId: updated.sessionId,
      items: updated.items,
      shipping: null,
      carrierLabel: carrierLabel(updated.carrier),
      trackingNumber: updated.trackingNumber ?? null,
      trackingUrl: trackingUrl(updated.carrier, updated.trackingNumber),
    });
  }

  return NextResponse.json({ ok: true, order: updated });
}
