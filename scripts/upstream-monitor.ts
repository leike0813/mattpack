import { parseArgs } from "node:util";

import { MonitorError, runUpstreamMonitor, type MonitorCommand } from "./lib/upstream-monitor.js";

function parse(): MonitorCommand {
  const [command, ...positionals] = process.argv.slice(2);
  const { values, positionals: rest } = parseArgs({
    args: positionals,
    options: {
      "owner-pid": { type: "string" },
      "base-ref": { type: "string" },
      "result-file": { type: "string" }
    },
    allowPositionals: true,
    strict: true
  });
  if (command === "start" && rest.length === 0 && !values["result-file"] && values["owner-pid"] && /^\d+$/u.test(values["owner-pid"])) {
    return {
      command, ownerPid: Number(values["owner-pid"]),
      ...(values["base-ref"] ? { baseRef: values["base-ref"] } : {})
    };
  }
  if (command === "status" && rest.length === 0 && !values["owner-pid"] && !values["base-ref"] && !values["result-file"]) {
    return { command };
  }
  if (command === "finish" && rest.length === 1 && rest[0] && values["result-file"] && !values["owner-pid"] && !values["base-ref"]) {
    return { command, runId: rest[0], resultFile: values["result-file"] };
  }
  if (command === "recover" && rest.length === 1 && rest[0] && !values["owner-pid"] && !values["base-ref"] && !values["result-file"]) {
    return { command, runId: rest[0] };
  }
  throw new MonitorError("INVALID_ARGUMENT", "Usage: start --owner-pid PID [--base-ref ref] | status | finish runId --result-file path | recover runId");
}

if (process.argv[2] === "--help" || process.argv[2] === "help") {
  process.stdout.write(`${JSON.stringify({ ok: true, result: { usage: "start --owner-pid PID [--base-ref ref] | status | finish runId --result-file path | recover runId" } })}\n`);
} else {
  try {
    const result = await runUpstreamMonitor(parse());
    process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
  } catch (error) {
    const code = error instanceof MonitorError ? error.code : "INTERNAL_ERROR";
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ ok: false, error: { code, message } })}\n`);
    process.exitCode = 1;
  }
}
