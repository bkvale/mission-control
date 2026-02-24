import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type Task = {
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

export async function GET() {
  const tasks = await readTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = String(body?.title || "").trim();
  const owner = body?.owner === "Ben" ? "Ben" : "Syl";

  if (!title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  const tasks = await readTasks();
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    owner,
    status: "Inbox",
    createdAt: new Date().toISOString(),
  };

  tasks.unshift(task);
  await saveTasks(tasks);
  return NextResponse.json({ task });
}
