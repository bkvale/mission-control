"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";

type StatusPayload = {
  status?: {
    gateway?: { reachable?: boolean; url?: string };
    linkChannel?: { id?: string; linked?: boolean };
    channelSummary?: string[];
  };
  stderr?: string | null;
  error?: string;
};

type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule?: { kind: string; expr?: string; everyMs?: number };
};

type CronPayload = { jobs?: CronJob[]; error?: string };

type XPayload = { text?: string; error?: string };

type Task = {
  id: string;
  title: string;
  owner: "Ben" | "Syl";
  status: "Inbox" | "Planned" | "In Progress" | "Waiting" | "Done";
  createdAt: string;
};

const STATUSES: Task["status"][] = ["Inbox", "Planned", "In Progress", "Waiting", "Done"];

export default function Home() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [cron, setCron] = useState<CronPayload | null>(null);
  const [xUrl, setXUrl] = useState("");
  const [xResult, setXResult] = useState<XPayload | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskOwner, setTaskOwner] = useState<"Ben" | "Syl">("Syl");
  const [memoryFiles, setMemoryFiles] = useState<string[]>([]);
  const [selectedMemoryPath, setSelectedMemoryPath] = useState("MEMORY.md");
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryHits, setMemoryHits] = useState<Array<{ path: string; snippet: string }>>([]);
  const [cronRunOutput, setCronRunOutput] = useState("");
  const [cronRunsOutput, setCronRunsOutput] = useState("");

  const loadStatus = async () => {
    setLoading("status");
    const res = await fetch("/api/status");
    setStatus(await res.json());
    setLoading(null);
  };

  const loadCron = async () => {
    setLoading("cron");
    const res = await fetch("/api/cron");
    setCron(await res.json());
    setLoading(null);
  };

  const extractX = async () => {
    setLoading("x");
    const res = await fetch("/api/x/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: xUrl }),
    });
    setXResult(await res.json());
    setLoading(null);
  };

  const loadTasks = async () => {
    const res = await fetch("/api/tasks");
    const json = await res.json();
    setTasks(json.tasks || []);
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: taskTitle, owner: taskOwner }),
    });
    setTaskTitle("");
    await loadTasks();
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadTasks();
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadTasks();
  };

  const runCronNow = async (id: string) => {
    setLoading(`cron-run-${id}`);
    const res = await fetch("/api/cron/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    setCronRunOutput(json.error || json.stderr || json.stdout || "Triggered.");
    setLoading(null);
  };

  const loadCronRuns = async (id: string) => {
    setLoading(`cron-runs-${id}`);
    const res = await fetch(`/api/cron/runs?id=${encodeURIComponent(id)}&limit=20`);
    const json = await res.json();
    setCronRunsOutput(json.error || json.output || "No run history output.");
    setLoading(null);
  };

  const loadMemoryFiles = async () => {
    const res = await fetch("/api/memory/files");
    const json = await res.json();
    setMemoryFiles(json.files || []);
  };

  const loadMemoryContent = async (path: string) => {
    const res = await fetch(`/api/memory/read?path=${encodeURIComponent(path)}`);
    const json = await res.json();
    setMemoryContent(json.content || json.error || "");
  };

  const searchMemory = async () => {
    const res = await fetch(`/api/memory/search?q=${encodeURIComponent(memoryQuery)}`);
    const json = await res.json();
    setMemoryHits(json.hits || []);
  };

  useEffect(() => {
    void loadStatus();
    void loadCron();
    void loadTasks();
    void loadMemoryFiles();
  }, []);

  useEffect(() => {
    if (!selectedMemoryPath) return;
    void loadMemoryContent(selectedMemoryPath);
  }, [selectedMemoryPath]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<Task["status"], Task[]>();
    for (const s of STATUSES) map.set(s, []);
    for (const t of tasks) map.get(t.status)?.push(t);
    return map;
  }, [tasks]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6 font-sans">
      <h1 className="text-3xl font-bold">Mission Control v1.5</h1>
      <p className="mt-2 text-sm opacity-80">Ops + Cron + X Ingestion + Task Board + Memory Explorer</p>

      <section className="mt-6 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Ops Status</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="rounded bg-black px-3 py-2 text-white" onClick={loadStatus} disabled={loading === "status"}>
            {loading === "status" ? "Loading..." : "Refresh status"}
          </button>
          <button className="rounded bg-black px-3 py-2 text-white" onClick={loadCron} disabled={loading === "cron"}>
            {loading === "cron" ? "Loading..." : "Refresh cron"}
          </button>
        </div>

        {status && (
          <div className="mt-4 space-y-1 text-sm">
            <div>Gateway: {status.status?.gateway?.reachable ? "✅ reachable" : "❌ unreachable"}</div>
            <div>Gateway URL: {status.status?.gateway?.url || "n/a"}</div>
            <div>Linked channel: {status.status?.linkChannel?.id || "n/a"}</div>
            {status.stderr ? <div className="text-amber-600">stderr: {status.stderr}</div> : null}
            {status.error ? <div className="text-red-600">error: {status.error}</div> : null}
          </div>
        )}

        {cron?.jobs && (
          <div className="mt-4">
            <h3 className="font-medium">Cron Jobs</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {cron.jobs.map((j) => (
                <li key={j.id} className="rounded border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      {j.enabled ? "✅" : "⏸️"} <strong>{j.name}</strong>
                      <div className="opacity-70">
                        {j.schedule?.kind}
                        {j.schedule?.expr
                          ? `: ${j.schedule.expr}`
                          : j.schedule?.everyMs
                          ? `: every ${Math.round(j.schedule.everyMs / 3600000)}h`
                          : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded border px-2 py-1"
                        onClick={() => loadCronRuns(j.id)}
                        disabled={loading === `cron-runs-${j.id}`}
                      >
                        {loading === `cron-runs-${j.id}` ? "Loading..." : "History"}
                      </button>
                      <button
                        className="rounded border px-2 py-1"
                        onClick={() => runCronNow(j.id)}
                        disabled={loading === `cron-run-${j.id}`}
                      >
                        {loading === `cron-run-${j.id}` ? "Running..." : "Run now"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {cronRunOutput ? <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs">{cronRunOutput}</pre> : null}
            {cronRunsOutput ? <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-100 p-2 text-xs">{cronRunsOutput}</pre> : null}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Tasks Board</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Add task"
            className="min-w-72 flex-1 rounded border px-3 py-2"
          />
          <select value={taskOwner} onChange={(e) => setTaskOwner(e.target.value as "Ben" | "Syl")} className="rounded border px-2 py-2">
            <option value="Syl">Syl</option>
            <option value="Ben">Ben</option>
          </select>
          <button className="rounded bg-black px-3 py-2 text-white" onClick={addTask}>Add</button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          {STATUSES.map((statusName) => (
            <div key={statusName} className="rounded border p-2">
              <h3 className="text-sm font-semibold">{statusName}</h3>
              <div className="mt-2 space-y-2">
                {(tasksByStatus.get(statusName) || []).map((t) => (
                  <div key={t.id} className="rounded border p-2 text-xs">
                    <div className="font-medium">{t.title}</div>
                    <div className="mt-1 opacity-70">Owner: {t.owner}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <select
                        value={t.status}
                        onChange={(e) => updateTask(t.id, { status: e.target.value as Task["status"] })}
                        className="rounded border px-1 py-0.5"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <select
                        value={t.owner}
                        onChange={(e) => updateTask(t.id, { owner: e.target.value as "Ben" | "Syl" })}
                        className="rounded border px-1 py-0.5"
                      >
                        <option value="Syl">Syl</option>
                        <option value="Ben">Ben</option>
                      </select>
                      <button className="rounded border px-1 py-0.5" onClick={() => deleteTask(t.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">X Ingestion</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={xUrl}
            onChange={(e) => setXUrl(e.target.value)}
            placeholder="Paste X URL"
            className="w-full rounded border px-3 py-2"
          />
          <button className="rounded bg-black px-3 py-2 text-white" onClick={extractX} disabled={loading === "x" || !xUrl}>
            {loading === "x" ? "Reading..." : "Read"}
          </button>
        </div>

        {xResult?.error ? <p className="mt-3 text-sm text-red-600">{xResult.error}</p> : null}
        {xResult?.text ? (
          <textarea className="mt-3 h-80 w-full rounded border p-3 text-sm" readOnly value={xResult.text} />
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border p-4">
        <h2 className="text-xl font-semibold">Memory Explorer</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr]">
          <div>
            <div className="text-sm font-medium">Files</div>
            <ul className="mt-2 space-y-1 text-sm">
              {memoryFiles.map((f) => (
                <li key={f}>
                  <button
                    className={`w-full rounded border px-2 py-1 text-left ${selectedMemoryPath === f ? "bg-zinc-100" : ""}`}
                    onClick={() => setSelectedMemoryPath(f)}
                  >
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 flex gap-2">
              <input
                value={memoryQuery}
                onChange={(e) => setMemoryQuery(e.target.value)}
                placeholder="Search memory..."
                className="w-full rounded border px-3 py-2"
              />
              <button className="rounded border px-3 py-2" onClick={searchMemory}>
                Search
              </button>
            </div>
            {memoryHits.length > 0 ? (
              <div className="mb-2 space-y-2 rounded border p-2 text-xs">
                {memoryHits.map((h, i) => (
                  <div key={i} className="rounded border p-2">
                    <div className="font-semibold">{h.path}</div>
                    <div className="opacity-80">{h.snippet}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea className="h-80 w-full rounded border p-3 text-sm" readOnly value={memoryContent} />
          </div>
        </div>
      </section>
    </main>
  );
}
