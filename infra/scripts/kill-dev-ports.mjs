import { execSync } from "node:child_process";

const DEV_PORTS = [3000, 3001, 3002, 3003, 3004, 5173, 5174, 5175];

function collectPidsFromNetstat() {
  const output = execSync("netstat -ano", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) continue;

    for (const port of DEV_PORTS) {
      const ipv4 = `0.0.0.0:${port}`;
      const ipv6 = `[::1]:${port}`;
      if (!line.includes(ipv4) && !line.includes(ipv6)) continue;

      const pid = line.trim().split(/\s+/).at(-1);
      if (pid && /^\d+$/.test(pid) && pid !== "0") {
        pids.add(pid);
      }
    }
  }

  return [...pids];
}

function collectPidsFromLsof() {
  const pids = new Set();

  for (const port of DEV_PORTS) {
    try {
      const output = execSync(`lsof -ti :${port}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      for (const pid of output.split(/\r?\n/)) {
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
    } catch {
      // No process on this port.
    }
  }

  return [...pids];
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    console.log(`Stopped process ${pid}`);
    return true;
  } catch {
    return false;
  }
}

const pids =
  process.platform === "win32" ? collectPidsFromNetstat() : collectPidsFromLsof();

if (pids.length === 0) {
  console.log("No dev processes found on ports:", DEV_PORTS.join(", "));
  process.exit(0);
}

let stopped = 0;
for (const pid of pids) {
  if (killPid(pid)) stopped += 1;
}

console.log(`Stopped ${stopped} process(es).`);
