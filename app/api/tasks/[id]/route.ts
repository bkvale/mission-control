import { NextRequest, NextResponse } from "next/server";
import { appendEvent, readJobs, saveJobs, type JobStatus } from "@/lib/jobs-store";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();

  const tasks = await readJobs();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx < 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const prev = { ...tasks[idx] };

  if (body?.status) tasks[idx].status = body.status as JobStatus;
  if (body?.owner) tasks[idx].owner = body.owner;
  if (body?.title) tasks[idx].title = String(body.title).trim();
  if (body?.priority && ["P0", "P1", "P2", "P3"].includes(body.priority)) tasks[idx].priority = body.priority;
  if (body?.sourceUrl !== undefined) tasks[idx].sourceUrl = String(body.sourceUrl || "").trim() || undefined;
  if (body?.blockers !== undefined) tasks[idx].blockers = String(body.blockers || "");
  if (body?.outputs !== undefined) {
    tasks[idx].outputs = Array.isArray(body.outputs)
      ? body.outputs.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];
  }
  if (body?.needsApproval !== undefined) tasks[idx].needsApproval = Boolean(body.needsApproval);
  if (body?.approved !== undefined) tasks[idx].approved = Boolean(body.approved);

  if (tasks[idx].needsApproval && !tasks[idx].approved && tasks[idx].status === "Done") {
    return NextResponse.json({ error: "Approval required before marking done." }, { status: 400 });
  }

  tasks[idx].updatedAt = new Date().toISOString();
  await saveJobs(tasks);

  if (prev.status !== tasks[idx].status) {
    await appendEvent({ jobId: id, type: "status_changed", message: `${prev.status} → ${tasks[idx].status}` });
  }
  if (!prev.needsApproval && tasks[idx].needsApproval) {
    await appendEvent({ jobId: id, type: "approval_required", message: "Marked as approval required" });
  }
  if (!prev.approved && tasks[idx].approved) {
    await appendEvent({ jobId: id, type: "approved", message: "Approved" });
  }
  await appendEvent({ jobId: id, type: "updated", message: "Job updated" });

  return NextResponse.json({ task: tasks[idx] });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tasks = await readJobs();
  const target = tasks.find((t) => t.id === id);
  const next = tasks.filter((t) => t.id !== id);
  await saveJobs(next);
  await appendEvent({ jobId: id, type: "deleted", message: `Deleted job: ${target?.title || id}` });
  return NextResponse.json({ ok: true });
}
