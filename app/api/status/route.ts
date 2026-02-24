import { NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw";
import { extractJsonObject } from "@/lib/cli-json";

export async function GET() {
  try {
    const { stdout, stderr } = await runOpenclaw(["status", "--json"], {
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    const status = extractJsonObject(stdout);
    return NextResponse.json({ status, stderr: stderr?.trim() || null });
  } catch (error: unknown) {
    const e = error as { message?: string; stdout?: string; stderr?: string };
    return NextResponse.json(
      {
        error: e?.message || "Unknown error",
        stdout: e?.stdout || null,
        stderr: e?.stderr || null,
      },
      { status: 500 }
    );
  }
}
