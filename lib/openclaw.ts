import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const WINDOWS_OPENCLAW_MJS = "C:\\Users\\Ben Kvale\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs";
const WINDOWS_OPENCLAW_CMD = "C:\\Users\\Ben Kvale\\AppData\\Roaming\\npm\\openclaw.cmd";

export async function runOpenclaw(args: string[], opts?: { timeout?: number; maxBuffer?: number }) {
  const timeout = opts?.timeout ?? 60_000;
  const maxBuffer = opts?.maxBuffer ?? 2 * 1024 * 1024;

  let lastError: unknown = null;

  if (process.platform === "win32") {
    const winCandidates: Array<{ cmd: string; argv: string[] }> = [
      ...(process.env.OPENCLAW_BIN ? [{ cmd: process.env.OPENCLAW_BIN, argv: args }] : []),
      { cmd: "node", argv: [WINDOWS_OPENCLAW_MJS, ...args] },
      { cmd: WINDOWS_OPENCLAW_CMD, argv: args },
      { cmd: "openclaw", argv: args },
    ];

    for (const c of winCandidates) {
      try {
        return await execFileAsync(c.cmd, c.argv, {
          windowsHide: true,
          timeout,
          maxBuffer,
        });
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError;
  }

  const candidates = [process.env.OPENCLAW_BIN, "openclaw"].filter(Boolean) as string[];
  for (const bin of candidates) {
    try {
      return await execFileAsync(bin, args, {
        windowsHide: true,
        timeout,
        maxBuffer,
      });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
