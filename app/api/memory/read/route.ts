import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

function resolveSafe(workspaceRoot: string, relPath: string) {
  const cleaned = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const full = path.resolve(workspaceRoot, cleaned);
  if (!full.startsWith(workspaceRoot)) throw new Error("Invalid path");
  return full;
}

export async function GET(req: NextRequest) {
  try {
    const relPath = req.nextUrl.searchParams.get("path") || "MEMORY.md";
    const workspaceRoot = path.resolve(process.cwd(), "..");
    const fullPath = resolveSafe(workspaceRoot, relPath);
    const content = await readFile(fullPath, "utf-8");
    return NextResponse.json({ path: relPath, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
