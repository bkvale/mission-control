import { NextRequest, NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Job id is required." }, { status: 400 });

    const { stdout, stderr } = await runOpenclaw(["cron", "run", String(id)], {
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    return NextResponse.json({ ok: true, stdout: stdout?.trim() || "", stderr: stderr?.trim() || "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
