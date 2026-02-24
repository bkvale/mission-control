import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Task = {
  id: string;
  title: string;
  owner: "Ben" | "Syl";
  status: "Inbox" | "Planned" | "In Progress" | "Waiting" | "Done";
  createdAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const tasksPath = path.join(dataDir, "tasks.json");

async function readTasks(): Promise<Task[]> {
  try {
    const raw = await readFile(tasksPath, "utf-8");
    return JSON.parse(raw) as Task[];
  } catch {
    return [];
  }
}

async function saveTasks(tasks: Task[]) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(tasksPath, JSON.stringify(tasks, null, 2), "utf-8");
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();

  const tasks = await readTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx < 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (body?.status) tasks[idx].status = body.status;
  if (body?.owner) tasks[idx].owner = body.owner;
  if (body?.title) tasks[idx].title = String(body.title);

  await saveTasks(tasks);
  return NextResponse.json({ task: tasks[idx] });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tasks = await readTasks();
  const next = tasks.filter((t) => t.id !== id);
  await saveTasks(next);
  return NextResponse.json({ ok: true });
}
