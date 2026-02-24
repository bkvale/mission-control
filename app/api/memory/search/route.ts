import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type Hit = { path: string; snippet: string };

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ hits: [] });

    const workspaceRoot = path.resolve(process.cwd(), "..");
    const memoryDir = path.join(workspaceRoot, "memory");
    const files = (await readdir(memoryDir)).filter((f) => f.endsWith(".md"));

    const targets = [
      { rel: "MEMORY.md", full: path.join(workspaceRoot, "MEMORY.md") },
      ...files.map((f) => ({ rel: `memory/${f}`, full: path.join(memoryDir, f) })),
    ];

    const hits: Hit[] = [];

    for (const t of targets) {
      const content = await readFile(t.full, "utf-8");
      const idx = content.toLowerCase().indexOf(q);
      if (idx >= 0) {
        const start = Math.max(0, idx - 120);
        const end = Math.min(content.length, idx + q.length + 220);
        hits.push({ path: t.rel, snippet: content.slice(start, end).replace(/\s+/g, " ") });
      }
    }

    return NextResponse.json({ hits: hits.slice(0, 20) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
