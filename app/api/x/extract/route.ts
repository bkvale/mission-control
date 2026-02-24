import { NextRequest, NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw";
import { extractJsonObject } from "@/lib/cli-json";

function isValidXUrl(value: string) {
  try {
    const u = new URL(value);
    return ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(u.hostname);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = String(body?.url || "").trim();

    if (!isValidXUrl(url)) {
      return NextResponse.json({ error: "Invalid X/Twitter URL." }, { status: 400 });
    }

    const openRes = await runOpenclaw(["browser", "open", url, "--browser-profile", "openclaw", "--json"], {
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    const openJson = extractJsonObject(openRes.stdout) as { targetId?: string };
    const targetId = openJson?.targetId;

    if (!targetId) {
      return NextResponse.json({ error: "No browser target returned." }, { status: 500 });
    }

    const fn = "() => { const a=document.querySelector('article'); return a ? a.innerText : (document.body?.innerText||'').slice(0, 12000); }";

    const evalRes = await runOpenclaw(
      ["browser", "evaluate", "--browser-profile", "openclaw", "--target-id", targetId, "--fn", fn, "--json"],
      { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 }
    );

    const evalJson = extractJsonObject(evalRes.stdout) as { result?: string };

    return NextResponse.json({
      url,
      targetId,
      text: evalJson?.result || "",
    });
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
