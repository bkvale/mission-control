import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { readBoardJobs, writeBoardJobs, boardPath } from "@/lib/board";

export type JobStatus = "Inbox" | "Planned" | "In Progress" | "Waiting" | "Done";
export type JobPriority = "P0" | "P1" | "P2" | "P3";

export type Job = {
  id: string;
  title: string;
  owner: "Ben" | "Syl";
  status: JobStatus;
  priority: JobPriority;
  sourceUrl?: string;
  blockers?: string;
  outputs: string[];
  needsApproval: boolean;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JobEvent = {
  id: string;
  jobId: string;
  type:
    | "created"
    | "updated"
    | "deleted"
    | "approval_required"
    | "approved"
    | "status_changed"
    | "ingest_attempt"
    | "ingest_fallback"
    | "ingest_success"
    | "ingest_failed";
  message: string;
  at: string;
};

const dataDir = path.join(process.cwd(), "data");
const jobsPath = path.join(dataDir, "tasks.json");
const eventsPath = path.join(dataDir, "events.json");

export async function readJobs(): Promise<Job[]> {
  const fromBoard = await readBoardJobs();
  if (fromBoard && fromBoard.length) return fromBoard.map(normalizeJob);

  try {
    const raw = await readFile(jobsPath, "utf-8");
    const parsed = JSON.parse(raw) as Job[];
    return parsed.map(normalizeJob);
  } catch {
    return [];
  }
}

export async function saveJobs(jobs: Job[]) {
  const normalized = jobs.map(normalizeJob);

  await mkdir(dataDir, { recursive: true });
  await writeFile(jobsPath, JSON.stringify(normalized, null, 2), "utf-8");

  await writeBoardJobs(normalized);
  await snapshotBoard();
}

export async function readEvents(limit = 200): Promise<JobEvent[]> {
  try {
    const raw = await readFile(eventsPath, "utf-8");
    const parsed = JSON.parse(raw) as JobEvent[];
    return parsed.slice(0, limit);
  } catch {
    return [];
  }
}

export async function appendEvent(event: Omit<JobEvent, "id" | "at">) {
  const existing = await readEvents(1000);
  const full: JobEvent = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...event,
  };
  existing.unshift(full);
  await mkdir(dataDir, { recursive: true });
  await writeFile(eventsPath, JSON.stringify(existing.slice(0, 1000), null, 2), "utf-8");
}

export async function appendDailyMemory(note: string) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;

  const memoryDir = path.join(process.cwd(), "..", "memory");
  const file = path.join(memoryDir, `${date}.md`);

  await mkdir(memoryDir, { recursive: true });

  let existing = "";
  try {
    existing = await readFile(file, "utf-8");
  } catch {
    existing = `# ${date}\n\n`;
  }

  const stamp = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const line = `- [${stamp}] ${note}`;
  const next = `${existing.trimEnd()}\n${line}\n`;
  await writeFile(file, next, "utf-8");
}

async function snapshotBoard() {
  try {
    const backupsDir = path.join(process.cwd(), "projects", ".snapshots");
    await mkdir(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await copyFile(boardPath, path.join(backupsDir, `command-center-board.${stamp}.md`));
  } catch {
    // non-fatal
  }
}

function normalizeJob(job: Job): Job {
  const now = new Date().toISOString();
  return {
    ...job,
    priority: job.priority || "P2",
    outputs: Array.isArray(job.outputs) ? job.outputs : [],
    needsApproval: Boolean(job.needsApproval),
    approved: Boolean(job.approved),
    updatedAt: job.updatedAt || job.createdAt || now,
    createdAt: job.createdAt || now,
  };
}
