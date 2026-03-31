import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { appendEvent, readJobs, saveJobs, type Job } from "@/lib/jobs-store";

export async function GET() {
  const tasks = await readJobs();
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = String(body?.title || "").trim();
  const owner = body?.owner === "Ben" ? "Ben" : "Syl";
  const sourceUrl = String(body?.sourceUrl || "").trim();
  const priority = ["P0", "P1", "P2", "P3"].includes(body?.priority) ? body.priority : "P2";

  if (!title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  const tasks = await readJobs();
  const now = new Date().toISOString();
  const task: Job = {
    id: crypto.randomUUID(),
    title,
    owner,
    sourceUrl: sourceUrl || undefined,
    priority,
    status: "Inbox",
    outputs: [],
    blockers: "",
    needsApproval: false,
    approved: false,
    createdAt: now,
    updatedAt: now,
  };

  tasks.unshift(task);
  await saveJobs(tasks);
  await appendEvent({ jobId: task.id, type: "created", message: `Created job: ${task.title}` });
  return NextResponse.json({ task });
}
