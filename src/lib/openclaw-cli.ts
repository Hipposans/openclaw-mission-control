import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { dirname, join } from "path";
import { access } from "fs/promises";
import { getOpenClawBin } from "./paths";

const exec = promisify(execFile);

/**
 * On Windows, cmd.exe strips quotes from JSON arguments passed to .cmd wrappers,
 * breaking `--params '{"key":"val"}'`. Work around by running node + openclaw.mjs
 * directly, which bypasses shell argument processing entirely.
 *
 * Returns { bin: "node", args: [mjsPath, ...originalArgs] } on Windows when the
 * .mjs entrypoint exists, or null to fall back to the original approach.
 */
async function resolveWindowsNodeArgs(
  binPath: string,
  originalArgs: string[],
): Promise<{ bin: string; spawnArgs: string[] } | null> {
  if (process.platform !== "win32") return null;
  // binPath may be .cmd or extensionless (from `which`). The .mjs lives at:
  //   <npm-global-bin-dir>/node_modules/openclaw/openclaw.mjs
  let binDir = dirname(binPath);
  // `which openclaw` on Windows returns a MSYS/Git-bash path like /c/Users/...
  // which Node.js path.join misinterprets as a relative path starting with \c\.
  // Convert to a proper Windows path before probing.
  const msys = binDir.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (msys) {
    binDir = `${msys[1].toUpperCase()}:${(msys[2] ?? "/").replace(/\//g, "\\")}`;
  }
  const mjsPath = join(binDir, "node_modules", "openclaw", "openclaw.mjs");
  try {
    await access(mjsPath);
    return { bin: "node", spawnArgs: [mjsPath, ...originalArgs] };
  } catch {
    return null;
  }
}

/** Env vars for all CLI subprocesses. Mission Control is always a trusted local process. */
const CLI_ENV = { ...process.env, NO_COLOR: "1" };

/** On Windows, .cmd files must be run with shell:true via execFile/spawn. */
function needsShell(bin: string): boolean {
  return process.platform === "win32" || bin.toLowerCase().endsWith(".cmd");
}

// ── Concurrency semaphore ──────────────────────────────────────────────────
// Caps the number of simultaneously live CLI subprocesses. Callers that
// exceed the limit are queued and resume in FIFO order as slots free up.

const CLI_MAX_CONCURRENT = 4;
const CLI_MAX_QUEUED = 12;
let cliInFlight = 0;
const cliQueue: Array<() => void> = [];

function acquireCliSlot(): Promise<void> {
  if (cliInFlight < CLI_MAX_CONCURRENT) {
    cliInFlight++;
    return Promise.resolve();
  }
  if (cliQueue.length >= CLI_MAX_QUEUED) {
    return Promise.reject(
      new Error(
        `CLI backpressure: ${cliInFlight} running, ${cliQueue.length} queued (limit ${CLI_MAX_QUEUED}). Rejecting to prevent OOM.`,
      ),
    );
  }
  return new Promise((resolve) => {
    cliQueue.push(() => {
      cliInFlight++;
      resolve();
    });
  });
}

function releaseCliSlot(): void {
  cliInFlight--;
  const next = cliQueue.shift();
  if (next) next();
}

/** Result of a CLI run when both stdout and stderr are captured. */
export type RunCliResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

/**
 * Run CLI and capture both stdout and stderr. Use for cron run and other
 * commands where we need to show full output on failure.
 */
export async function runCliCaptureBoth(
  args: string[],
  timeout = 15000
): Promise<RunCliResult> {
  await acquireCliSlot();
  try {
    const bin = await getOpenClawBin();
    const winNode = await resolveWindowsNodeArgs(bin, args);
    const spawnBin = winNode ? winNode.bin : bin;
    const spawnArgs = winNode ? winNode.spawnArgs : args;
    return await new Promise((resolve, reject) => {
      const child = spawn(spawnBin, spawnArgs, {
        env: CLI_ENV,
        timeout,
        stdio: ["ignore", "pipe", "pipe"],
        shell: winNode ? false : needsShell(bin),
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      child.on("close", (code, signal) => {
        resolve({
          stdout,
          stderr,
          code: code ?? (signal ? -1 : 0),
        });
      });
      child.on("error", reject);
    });
  } finally {
    releaseCliSlot();
  }
}

export async function runCli(
  args: string[],
  timeout = 15000,
  stdin?: string
): Promise<string> {
  await acquireCliSlot();
  try {
    const bin = await getOpenClawBin();
    if (stdin !== undefined) {
      // Use spawn for stdin piping
      const winNode = await resolveWindowsNodeArgs(bin, args);
      const spawnBin = winNode ? winNode.bin : bin;
      const spawnArgs = winNode ? winNode.spawnArgs : args;
      return await new Promise((resolve, reject) => {
        const child = spawn(spawnBin, spawnArgs, {
          env: CLI_ENV,
          timeout,
          stdio: ["pipe", "pipe", "pipe"],
          shell: winNode ? false : needsShell(bin),
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
        child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        child.on("close", (code) => {
          if (code === 0) resolve(stdout);
          else reject(new Error(`Command failed (exit ${code}): ${stderr || stdout}`));
        });
        child.on("error", reject);
        child.stdin.write(stdin);
        child.stdin.end();
      });
    }
    const winNode = await resolveWindowsNodeArgs(bin, args);
    if (winNode) {
      const { stdout } = await exec(winNode.bin, winNode.spawnArgs, {
        timeout,
        env: CLI_ENV,
        shell: false,
      });
      return stdout;
    }
    const { stdout } = await exec(bin, args, {
      timeout,
      env: CLI_ENV,
      shell: needsShell(bin),
    });
    return stdout;
  } finally {
    releaseCliSlot();
  }
}

const ANSI_ESCAPE_PATTERN =
  // Matches CSI and related ANSI escape sequences.
  /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, "");
}

function parseJsonCandidate<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function findJsonSuffix(rawOutput: string): string | null {
  const cleaned = stripAnsi(rawOutput).replace(/\r/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    return cleaned;
  }

  const starts: number[] = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ch === "{" || ch === "[") starts.push(i);
  }

  for (let i = starts.length - 1; i >= 0; i -= 1) {
    const candidate = cleaned.slice(starts[i]).trim();
    if (!candidate) continue;
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) continue;
    if (parseJsonCandidate(candidate) !== null) {
      return candidate;
    }
  }

  return null;
}

export function parseJsonFromCliOutput<T>(
  rawOutput: string,
  context = "CLI output"
): T {
  const candidate = findJsonSuffix(rawOutput);
  if (!candidate) {
    const snippet = stripAnsi(rawOutput).replace(/\r/g, "").trim().slice(0, 400);
    throw new Error(
      snippet
        ? `Failed to parse JSON from ${context}. Output: ${snippet}`
        : `Failed to parse JSON from ${context}: empty output`
    );
  }
  return JSON.parse(candidate) as T;
}

export async function runCliJson<T>(
  args: string[],
  timeout = 15000
): Promise<T> {
  // Use runCliCaptureBoth so we can check stderr when stdout is empty.
  // On Windows, openclaw.mjs spawned without a shell writes --json output
  // to stderr instead of stdout (observed with node openclaw.mjs subprocess).
  const context = `openclaw ${args.join(" ")} --json`;
  let result: RunCliResult;
  try {
    result = await runCliCaptureBoth([...args, "--json"], timeout);
  } catch (err) {
    // Spawn-level error — try legacy stdout-only path as fallback.
    const stdout = typeof (err as { stdout?: unknown })?.stdout === "string"
      ? String((err as { stdout?: unknown }).stdout)
      : "";
    if (stdout.trim()) {
      try {
        return parseJsonFromCliOutput<T>(stdout, context);
      } catch {
        // Fall through to original error.
      }
    }
    throw err;
  }
  // Try stdout first (normal case), then stderr (Windows mjs subprocess quirk).
  const output = result.stdout.trim() ? result.stdout : result.stderr;
  if (!output.trim() && result.code !== 0) {
    throw new Error(`Command failed (exit ${result.code}): ${result.stderr || result.stdout}`);
  }
  return parseJsonFromCliOutput<T>(output, context);
}

export async function gatewayCall<T>(
  method: string,
  params?: Record<string, unknown>,
  timeout = 15000
): Promise<T> {
  const args = ["gateway", "call", method, "--json"];
  if (params) args.push("--params", JSON.stringify(params));
  if (timeout > 10000) args.push("--timeout", String(timeout));
  const stdout = await runCli(args, timeout + 5000);
  return parseJsonFromCliOutput<T>(stdout, `openclaw gateway call ${method}`);
}
