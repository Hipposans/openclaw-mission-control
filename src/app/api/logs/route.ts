import { NextRequest, NextResponse } from "next/server";
import { open, readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { getOpenClawHome } from "@/lib/paths";

const OPENCLAW_HOME = getOpenClawHome();
const LOGS_DIR = join(OPENCLAW_HOME, "logs");

type LogEntry = {
  line: number;
  time: string;
  timeMs: number; // UTC millis for correct sorting
  source: string;
  level: "info" | "warn" | "error";
  message: string;
  raw: string;
};

/**
 * GET /api/logs - Returns parsed log entries from gateway logs.
 *
 * Query params:
 *   type=gateway|error|all (default: all)
 *   limit=N (default: 200, max: 1000)
 *   search=text (filter by text content)
 *   source=ws|cron|telegram|... (filter by source tag)
 *   level=info|warn|error (filter by level)
 */
export const dynamic = "force-dynamic";

// Full structured line: timestamp [source] message
const STRUCTURED_RE =
  /^(\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))\s+\[([^\]]+)\]\s+(.*)/;

// Timestamp-only line (no [source]): timestamp message
const TS_ONLY_RE =
  /^(\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))\s+(.*)/;

// Time-only structured line (no date): HH:mm:ss±HH:mm [source] message
// Used in watchdog-created gateway-crash-*.log files which omit the date.
const TIME_STRUCTURED_RE =
  /^(\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})\s+\[([^\]]+)\]\s+(.*)/;

/** Extract YYYY-MM-DD date string from a gateway-crash-YYYYMMDD-HHMM.log filename. */
function dateFromCrashFilename(filePath: string): string | null {
  const m = filePath.match(/gateway-crash-(\d{4})(\d{2})(\d{2})-\d{4}\.log$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Strip ANSI color/control escape codes from a string. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
}

/**
 * Find the most-recent gateway-crash-*.log files in OPENCLAW_HOME.
 * These are created by the watchdog on each gateway restart and contain
 * the gateway's stderr (which is where structured log output goes).
 */
async function findCrashLogs(maxFiles = 5): Promise<string[]> {
  try {
    const entries = await readdir(OPENCLAW_HOME);
    const crashLogs = entries
      .filter((f) => /^gateway-crash-\d{8}-\d{4}\.log$/.test(f))
      .map((f) => join(OPENCLAW_HOME, f));
    // Filenames embed timestamps — sort descending so newest are first
    crashLogs.sort((a, b) => b.localeCompare(a));
    return crashLogs.slice(0, maxFiles);
  } catch {
    return [];
  }
}

/** Parse an ISO timestamp to UTC millis. Returns 0 on failure. */
function tsToMs(ts: string): number {
  if (!ts) return 0;
  try {
    const ms = new Date(ts).getTime();
    return isNaN(ms) ? 0 : ms;
  } catch {
    return 0;
  }
}

/**
 * Parse raw log lines into structured entries.
 * Handles:
 *   1. Structured lines: `TIMESTAMP [SOURCE] MESSAGE`
 *   2. Timestamp-only lines: `TIMESTAMP MESSAGE` (no source tag)
 *   3. Time-only structured lines: `HH:mm:ss±TZ [SOURCE] MESSAGE` (gateway-crash logs)
 *   4. Continuation lines: no timestamp — appended to previous entry
 *
 * @param fileDate YYYY-MM-DD date to prepend to time-only timestamps (from filename)
 */
function parseLines(
  lines: string[],
  fileLevel: "info" | "error",
  fileDate?: string,
): LogEntry[] {
  const entries: LogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = stripAnsi(lines[i]);
    if (!raw) continue;

    // Try full structured: TIMESTAMP [source] message
    const structMatch = raw.match(STRUCTURED_RE);
    if (structMatch) {
      const time = structMatch[1];
      const source = structMatch[2];
      const message = structMatch[3];
      const level = detectLevel(message, fileLevel);
      entries.push({ line: i, time, timeMs: tsToMs(time), source, level, message, raw });
      continue;
    }

    // Try timestamp-only (full date): TIMESTAMP message (no [source] tag)
    const tsMatch = raw.match(TS_ONLY_RE);
    if (tsMatch) {
      const time = tsMatch[1];
      const message = tsMatch[2];
      const level = detectLevel(message, fileLevel);
      const source = fileLevel === "error" ? "system" : "agent";
      entries.push({ line: i, time, timeMs: tsToMs(time), source, level, message, raw });
      continue;
    }

    // Try time-only structured: HH:mm:ss±TZ [source] message (gateway-crash-*.log format)
    const timeStructMatch = raw.match(TIME_STRUCTURED_RE);
    if (timeStructMatch) {
      const timePart = timeStructMatch[1];
      const source = timeStructMatch[2];
      const message = timeStructMatch[3];
      const level = detectLevel(message, fileLevel);
      // Construct full ISO timestamp using the date from the filename
      const time = fileDate ? `${fileDate}T${timePart}` : timePart;
      entries.push({ line: i, time, timeMs: tsToMs(time), source, level, message, raw });
      continue;
    }

    // Continuation line: append to previous entry
    if (entries.length > 0) {
      const prev = entries[entries.length - 1];
      prev.message += "\n" + raw;
      prev.raw += "\n" + raw;
    }
    // else: orphan continuation before any entry — skip
  }

  return entries;
}

function detectLevel(
  message: string,
  fileLevel: "info" | "error"
): "info" | "warn" | "error" {
  if (fileLevel === "error") return "error";
  if (/\berror\b|failed|INVALID_REQUEST/i.test(message)) return "error";
  if (/\u2717|\u2718|errorCode=/.test(message)) return "error";
  if (/\bwarn\b|warning|timeout|timed out|skipped/i.test(message))
    return "warn";
  return "info";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "200", 10),
    1000
  );
  const searchFilter = searchParams.get("search")?.toLowerCase() || "";
  const sourceFilter = searchParams.get("source")?.toLowerCase() || "";
  const levelFilter = searchParams.get("level") || "";

  try {
    const files: { path: string; level: "info" | "error" }[] = [];
    if (type === "gateway" || type === "all") {
      files.push({ path: join(LOGS_DIR, "gateway.log"), level: "info" });
    }
    if (type === "error" || type === "all") {
      files.push({
        path: join(LOGS_DIR, "gateway.err.log"),
        level: "error",
      });
      // Scan for watchdog-created crash logs (gateway-crash-YYYYMMDD-HHMM.log)
      // These live at the openclaw home root and are the primary log source until
      // gateway.log/gateway.err.log are configured.
      const crashLogs = await findCrashLogs(5);
      for (const p of crashLogs) {
        files.push({ path: p, level: "error" });
      }
    }

    const fileResults = await Promise.all(
      files.map(async (file) => {
        try {
          const s = await stat(file.path);

          // Read last portion of file (max 500KB to keep response fast)
          const maxBytes = 512 * 1024;
          let content: string;
          if (s.size > maxBytes) {
            const fh = await open(file.path, "r");
            try {
              const buf = Buffer.alloc(maxBytes);
              await fh.read(buf, 0, maxBytes, s.size - maxBytes);
              content = buf.toString("utf-8");
            } finally {
              await fh.close();
            }
            // Drop first partial line
            const firstNewline = content.indexOf("\n");
            if (firstNewline !== -1) {
              content = content.slice(firstNewline + 1);
            }
          } else {
            content = await readFile(file.path, "utf-8");
          }

          const lines = content.split("\n");
          const fileDate = dateFromCrashFilename(file.path) ?? undefined;
          return {
            path: file.path,
            size: s.size,
            entries: parseLines(lines, file.level, fileDate),
          };
        } catch {
          return {
            path: file.path,
            size: 0,
            entries: [] as LogEntry[],
          };
        }
      })
    );

    const allEntries: LogEntry[] = [];
    const fileSizes: Record<string, number> = {};
    const sourceSet = new Set<string>();
    const stats = { info: 0, warn: 0, error: 0 };
    for (const result of fileResults) {
      if (result.size > 0) {
        fileSizes[result.path] = result.size;
      }
      for (const entry of result.entries) {
        allEntries.push(entry);
        if (entry.source) sourceSet.add(entry.source);
        stats[entry.level] += 1;
      }
    }

    // Sort by UTC time descending (newest first)
    allEntries.sort((a, b) => b.timeMs - a.timeMs);

    const hasFilters = Boolean(searchFilter || sourceFilter || levelFilter);
    const filtered = hasFilters
      ? allEntries.filter((e) => {
        if (searchFilter) {
          const searchHit =
            e.message.toLowerCase().includes(searchFilter) ||
            e.source.toLowerCase().includes(searchFilter) ||
            e.raw.toLowerCase().includes(searchFilter);
          if (!searchHit) return false;
        }
        if (sourceFilter && !e.source.toLowerCase().includes(sourceFilter)) return false;
        if (levelFilter && e.level !== levelFilter) return false;
        return true;
      })
      : allEntries;

    // Collect unique sources for the filter UI
    const sources = Array.from(sourceSet).sort();

    const responseData = {
      entries: filtered.slice(0, limit),
      total: filtered.length,
      sources,
      fileSizes,
      stats,
    };
    return NextResponse.json(responseData);
  } catch (err) {
    console.error("Logs API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
