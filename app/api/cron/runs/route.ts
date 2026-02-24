import { NextRequest, NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")?.trim();
    const limit = req.nextUrl.searchParams.get("limit")?.trim() || "20";

    if (!id) {
      return NextResponse.json({ error: "Job id is required." }, { status: 400 });
    }

    const { stdout } = await runOpenclaw(["cron", "runs", "--id", id, "--limit", limit], {
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    return NextResponse.json({ output: stdout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
