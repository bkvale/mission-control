import { NextRequest, NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw";
import { extractJsonObject } from "@/lib/cli-json";
import { appendEvent } from "@/lib/jobs-store";

function isValidXUrl(value: string) {
  try {
    const u = new URL(value);
    return ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(u.hostname);
  } catch {
    return false;
  }
}

type Attempt = {
  method: "fast" | "dynamic" | "stealth";
  outcome: "success" | "failed" | "blocked";
  reason?: string;
  durationMs: number;
};

function analyzeText(text: string) {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return { ok: false, blocked: false, reason: "empty_text" };

  const blockedSignals = [
    "log in",
    "sign up",
    "don’t miss what’s happening",
    "something went wrong",
    "challenge",
    "cloudflare",
    "verify you are human",
    "rate limit",
  ];

  const isBlocked = blockedSignals.some((s) => t.includes(s));
  if (isBlocked) return { ok: false, blocked: true, reason: "login_or_challenge_wall" };

  if (text.length < 80) return { ok: false, blocked: false, reason: "too_short" };

  return { ok: true, blocked: false };
}

async function evaluateText(targetId: string, fn: string, timeout = 90_000) {
  const evalRes = await runOpenclaw(
    ["browser", "evaluate", "--browser-profile", "openclaw", "--target-id", targetId, "--fn", fn, "--json"],
    { timeout, maxBuffer: 4 * 1024 * 1024 }
  );
  const evalJson = extractJsonObject(evalRes.stdout) as { result?: string };
  return String(evalJson?.result || "").trim();
}

async function snapshotText(targetId: string) {
  const snapRes = await runOpenclaw(
    ["browser", "snapshot", "--browser-profile", "openclaw", "--target-id", targetId, "--refs", "aria", "--json"],
    { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 }
  );

  const snapJson = extractJsonObject(snapRes.stdout) as { nodes?: Array<{ role?: string; name?: string }> };
  const nodes = snapJson?.nodes || [];
  const chunks = nodes
    .filter((n) => n?.role === "StaticText" && n?.name)
    .map((n) => String(n.name).trim())
    .filter(Boolean)
    .slice(0, 800);

  return chunks.join("\n").slice(0, 12000);
}

async function openTarget(url: string) {
  const openRes = await runOpenclaw(["browser", "open", url, "--browser-profile", "openclaw", "--json"], {
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const openJson = extractJsonObject(openRes.stdout) as { targetId?: string };
  return openJson?.targetId;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const attempts: Attempt[] = [];

  try {
    const body = await req.json();
    const url = String(body?.url || "").trim();
    const jobId = String(body?.jobId || "system:x").trim() || "system:x";

    if (!isValidXUrl(url)) {
      return NextResponse.json({ error: "Invalid X/Twitter URL." }, { status: 400 });
    }

    const targetId = await openTarget(url);
    if (!targetId) {
      return NextResponse.json({ error: "No browser target returned.", attempts }, { status: 500 });
    }

    // 1) FAST: light article/body extraction
    {
      const t0 = Date.now();
      await appendEvent({ jobId, type: "ingest_attempt", message: "attempt method=fast" });
      try {
        const text = await evaluateText(
          targetId,
          "() => { const a=document.querySelector('article'); return a ? a.innerText : (document.body?.innerText||'').slice(0, 12000); }",
          60_000
        );
        const analysis = analyzeText(text);
        if (analysis.ok) {
          attempts.push({ method: "fast", outcome: "success", durationMs: Date.now() - t0 });
          await appendEvent({ jobId, type: "ingest_success", message: `method=fast url=${url}` });
          return NextResponse.json({
            url,
            targetId,
            text,
            methodUsed: "fast",
            attempts,
            blockedReason: null,
            confidence: "high",
            tookMs: Date.now() - started,
          });
        }

        attempts.push({
          method: "fast",
          outcome: analysis.blocked ? "blocked" : "failed",
          reason: analysis.reason,
          durationMs: Date.now() - t0,
        });
        await appendEvent({ jobId, type: "ingest_fallback", message: `fast -> dynamic reason=${analysis.reason}` });
      } catch (e: unknown) {
        attempts.push({
          method: "fast",
          outcome: "failed",
          reason: (e as { message?: string })?.message || "fast_exception",
          durationMs: Date.now() - t0,
        });
        await appendEvent({ jobId, type: "ingest_attempt", message: `fast failed` });
      }
    }

    // 2) DYNAMIC: richer selectors
    {
      const t0 = Date.now();
      await appendEvent({ jobId, type: "ingest_attempt", message: "attempt method=dynamic" });
      try {
        const text = await evaluateText(
          targetId,
          `() => {
            const article = document.querySelector('article');
            const candidates = [
              article?.innerText,
              document.querySelector('[data-testid="primaryColumn"]')?.innerText,
              document.querySelector('main')?.innerText,
              document.body?.innerText,
            ].filter(Boolean);
            return (candidates[0] || '').slice(0, 12000);
          }`,
          90_000
        );
        const analysis = analyzeText(text);
        if (analysis.ok) {
          attempts.push({ method: "dynamic", outcome: "success", durationMs: Date.now() - t0 });
          await appendEvent({ jobId, type: "ingest_success", message: `method=dynamic url=${url}` });
          return NextResponse.json({
            url,
            targetId,
            text,
            methodUsed: "dynamic",
            attempts,
            blockedReason: null,
            confidence: "medium",
            tookMs: Date.now() - started,
          });
        }

        attempts.push({
          method: "dynamic",
          outcome: analysis.blocked ? "blocked" : "failed",
          reason: analysis.reason,
          durationMs: Date.now() - t0,
        });
        await appendEvent({ jobId, type: "ingest_fallback", message: `dynamic -> stealth reason=${analysis.reason}` });
      } catch (e: unknown) {
        attempts.push({
          method: "dynamic",
          outcome: "failed",
          reason: (e as { message?: string })?.message || "dynamic_exception",
          durationMs: Date.now() - t0,
        });
      }
    }

    // 3) STEALTH-ish fallback: snapshot static text extraction
    {
      const t0 = Date.now();
      await appendEvent({ jobId, type: "ingest_attempt", message: "attempt method=stealth" });
      try {
        const text = await snapshotText(targetId);
        const analysis = analyzeText(text);
        if (analysis.ok) {
          attempts.push({ method: "stealth", outcome: "success", durationMs: Date.now() - t0 });
          await appendEvent({ jobId, type: "ingest_success", message: `method=stealth url=${url}` });
          return NextResponse.json({
            url,
            targetId,
            text,
            methodUsed: "stealth",
            attempts,
            blockedReason: null,
            confidence: "low",
            tookMs: Date.now() - started,
          });
        }

        attempts.push({
          method: "stealth",
          outcome: analysis.blocked ? "blocked" : "failed",
          reason: analysis.reason,
          durationMs: Date.now() - t0,
        });
      } catch (e: unknown) {
        attempts.push({
          method: "stealth",
          outcome: "failed",
          reason: (e as { message?: string })?.message || "stealth_exception",
          durationMs: Date.now() - t0,
        });
      }
    }

    const blockedAttempt = attempts.find((a) => a.outcome === "blocked");
    await appendEvent({ jobId, type: "ingest_failed", message: `url=${url} reason=${blockedAttempt?.reason || "no_extract"}` });

    return NextResponse.json(
      {
        error: "Could not extract content from X URL.",
        url,
        targetId,
        attempts,
        methodUsed: null,
        blockedReason: blockedAttempt?.reason || null,
        confidence: "low",
        operatorHint: blockedAttempt
          ? "Looks like login/challenge wall. Re-open X in openclaw profile and verify session."
          : "Try again, or provide screenshot/text fallback.",
        tookMs: Date.now() - started,
      },
      { status: 502 }
    );
  } catch (error: unknown) {
    const e = error as { message?: string; stdout?: string; stderr?: string };
    return NextResponse.json(
      {
        error: e?.message || "Unknown error",
        stdout: e?.stdout || null,
        stderr: e?.stderr || null,
        attempts,
      },
      { status: 500 }
    );
  }
}
