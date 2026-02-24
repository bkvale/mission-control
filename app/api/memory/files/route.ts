import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  try {
    const workspaceRoot = path.resolve(process.cwd(), "..");
    const memoryDir = path.join(workspaceRoot, "memory");
    const files = await readdir(memoryDir);
    const mdFiles = files.filter((f) => f.endsWith(".md")).sort().reverse();

    return NextResponse.json({
      files: ["MEMORY.md", ...mdFiles.map((f) => `memory/${f}`)],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
