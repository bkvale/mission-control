import { NextRequest, NextResponse } from "next/server";
import { readEvents } from "@/lib/jobs-store";

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(500, Math.max(1, Number(limitParam || "100")));
  const events = await readEvents(limit);
  return NextResponse.json({ events });
}
