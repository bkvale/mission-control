import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

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
  type: "created" | "updated" | "deleted" | "approval_required" | "approved" | "status_changed";
  message: string;
  at: string;
};

const dataDir = path.join(process.cwd(), "data");
const jobsPath = path.join(dataDir, "tasks.json");
const eventsPath = path.join(dataDir, "events.json");

export async function readJobs(): Promise<Job[]> {
  try {
    const raw = await readFile(jobsPath, "utf-8");
    const parsed = JSON.parse(raw) as Job[];
    return parsed.map(normalizeJob);
  } catch {
    return [];
  }
}

export async function saveJobs(jobs: Job[]) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(jobsPath, JSON.stringify(jobs, null, 2), "utf-8");
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

function normalizeJob(job: Job): Job {
  const now = new Date().toISOString();
  return {
    ...job,
    priority: job.priority || "P2",
    outputs: Array.isArray(job.outputs) ? job.outputs : [],
    needsApproval: Boolean(job.needsApproval),
    approved: Boolean(job.approved),
    updatedAt: job.updatedAt || job.createdAt || now,
  };
}
