import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Job, JobStatus } from "@/lib/jobs-store";

const STATUSES: JobStatus[] = ["Inbox", "Planned", "In Progress", "Waiting", "Done"];
export const boardPath = path.join(process.cwd(), "projects", "command-center-board.md");

export async function readBoardJobs(): Promise<Job[] | null> {
  try {
    const raw = await readFile(boardPath, "utf-8");
    return parseBoard(raw);
  } catch {
    return null;
  }
}

export async function writeBoardJobs(jobs: Job[]) {
  await mkdir(path.dirname(boardPath), { recursive: true });
  await writeFile(boardPath, stringifyBoard(jobs), "utf-8");
}

function parseBoard(markdown: string): Job[] {
  const lines = markdown.split(/\r?\n/);
  const jobs: Job[] = [];
  let currentStatus: JobStatus | null = null;

  for (const line of lines) {
    const section = line.match(/^##\s+(Inbox|Planned|In Progress|Waiting|Done)$/);
    if (section) {
      currentStatus = section[1] as JobStatus;
      continue;
    }

    const m = line.match(/^[-*]\s+\[(.+?)\]\s+(.+?)\s*\|\s*(.+)$/);
    if (!m || !currentStatus) continue;

    const [, id, title, meta] = m;
    const metaMap = Object.fromEntries(
      meta.split("|").map((part) => {
        const [k, ...rest] = part.split("=");
        return [k.trim(), rest.join("=").trim()];
      })
    );

    const outputs = (metaMap.outputs || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    jobs.push({
      id: id.trim(),
      title: title.trim(),
      status: currentStatus,
      owner: metaMap.owner === "Ben" ? "Ben" : "Syl",
      priority: ["P0", "P1", "P2", "P3"].includes(metaMap.priority) ? (metaMap.priority as Job["priority"]) : "P2",
      sourceUrl: metaMap.sourceUrl || undefined,
      blockers: metaMap.blockers || "",
      outputs,
      needsApproval: metaMap.needsApproval === "true",
      approved: metaMap.approved === "true",
      createdAt: metaMap.createdAt || new Date().toISOString(),
      updatedAt: metaMap.updatedAt || new Date().toISOString(),
    });
  }

  return jobs;
}

function stringifyBoard(jobs: Job[]): string {
  const byStatus = new Map<JobStatus, Job[]>();
  for (const s of STATUSES) byStatus.set(s, []);
  for (const j of jobs) byStatus.get(j.status)?.push(j);

  const out: string[] = [];
  out.push("# Command Center Board");
  out.push("");
  out.push("_Canonical board for Mission Control. Editable in Obsidian._");
  out.push("");

  for (const s of STATUSES) {
    out.push(`## ${s}`);
    const rows = byStatus.get(s) || [];
    if (rows.length === 0) {
      out.push("- (empty)");
      out.push("");
      continue;
    }

    for (const j of rows) {
      const safeTitle = j.title.replace(/\|/g, "/").trim();
      const blockers = (j.blockers || "").replace(/\|/g, "/").trim();
      out.push(
        `- [${j.id}] ${safeTitle} | owner=${j.owner} | priority=${j.priority} | needsApproval=${j.needsApproval} | approved=${j.approved} | sourceUrl=${j.sourceUrl || ""} | blockers=${blockers} | outputs=${j.outputs.join(",")} | createdAt=${j.createdAt} | updatedAt=${j.updatedAt}`
      );
    }
    out.push("");
  }

  return out.join("\n");
}
