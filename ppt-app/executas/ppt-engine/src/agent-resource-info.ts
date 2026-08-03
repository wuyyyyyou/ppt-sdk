import { readFile } from "node:fs/promises";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";

export type AgentResourceLimitSource = "cgroup" | "system" | "unknown";

export interface AgentResourceInfo {
  sampled_at: string;
  sample_duration_ms: number;
  environment: {
    platform: string;
    arch: string;
    node_version: string;
  };
  cpu: {
    system_usage_percent: number | null;
    configured_cores: number;
    visible_cores: number;
    limit_source: AgentResourceLimitSource;
    load_average: number[] | null;
  };
  memory: {
    used_bytes: number;
    available_bytes: number;
    total_bytes: number;
    usage_percent: number | null;
    limit_source: AgentResourceLimitSource;
  };
  process: {
    pid: number;
    cpu_usage_percent: number | null;
    rss_bytes: number;
    heap_used_bytes: number;
    heap_total_bytes: number;
    external_bytes: number;
    uptime_seconds: number;
  };
}

interface CgroupLimits {
  cpu_cores: number | null;
  memory_limit_bytes: number | null;
  memory_used_bytes: number | null;
}

const SAMPLE_WINDOW_MS = 120;

function finitePositive(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0 ? value : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function parseLimit(value: string): number | null {
  const normalized = value.trim();
  if (!normalized || normalized === "max") return null;
  const parsed = Number(normalized);
  // cgroup v1 uses a very large sentinel value for an unlimited memory limit.
  return parsed >= 2 ** 60 ? null : finitePositive(parsed);
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function readCgroupLimits(): Promise<CgroupLimits> {
  const v2Cpu = await readText("/sys/fs/cgroup/cpu.max");
  const v2MemoryLimit = await readText("/sys/fs/cgroup/memory.max");
  const v2MemoryCurrent = await readText("/sys/fs/cgroup/memory.current");
  if (v2Cpu !== null || v2MemoryLimit !== null || v2MemoryCurrent !== null) {
    const [quota, period] = (v2Cpu ?? "").trim().split(/\s+/).map(Number);
    return {
      cpu_cores: Number.isFinite(quota) && quota > 0 && Number.isFinite(period) && period > 0 ? quota / period : null,
      memory_limit_bytes: parseLimit(v2MemoryLimit ?? ""),
      memory_used_bytes: finitePositive(Number((v2MemoryCurrent ?? "").trim())),
    };
  }

  const [v1CpuQuota, v1CpuPeriod, v1MemoryLimit, v1MemoryCurrent] = await Promise.all([
    readText("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"),
    readText("/sys/fs/cgroup/cpu/cpu.cfs_period_us"),
    readText("/sys/fs/cgroup/memory/memory.limit_in_bytes"),
    readText("/sys/fs/cgroup/memory/memory.usage_in_bytes"),
  ]);
  const quota = Number(v1CpuQuota);
  const period = Number(v1CpuPeriod);
  return {
    cpu_cores: quota > 0 && period > 0 ? quota / period : null,
    memory_limit_bytes: parseLimit(v1MemoryLimit ?? ""),
    memory_used_bytes: finitePositive(Number(v1MemoryCurrent)),
  };
}

function readCpuSnapshot() {
  return os.cpus().map((cpu) => {
    const times = cpu.times;
    return {
      idle: times.idle,
      total: times.user + times.nice + times.sys + times.idle + times.irq,
    };
  });
}

function calculateSystemCpuUsage(before: ReturnType<typeof readCpuSnapshot>, after: ReturnType<typeof readCpuSnapshot>): number | null {
  if (before.length === 0 || before.length !== after.length) return null;
  let idle = 0;
  let total = 0;
  for (let index = 0; index < before.length; index += 1) {
    idle += after[index].idle - before[index].idle;
    total += after[index].total - before[index].total;
  }
  return total > 0 ? clampPercent((1 - idle / total) * 100) : null;
}

export async function getAgentResourceInfo(): Promise<AgentResourceInfo> {
  const visibleCores = Math.max(1, os.cpus().length);
  const beforeCpu = readCpuSnapshot();
  const beforeProcessCpu = process.cpuUsage();
  const beforeTime = process.hrtime.bigint();
  const cgroup = await readCgroupLimits();
  await delay(SAMPLE_WINDOW_MS);
  const afterCpu = readCpuSnapshot();
  const afterProcessCpu = process.cpuUsage(beforeProcessCpu);
  const elapsedMs = Math.max(1, Number(process.hrtime.bigint() - beforeTime) / 1_000_000);
  const configuredCores = cgroup.cpu_cores ?? visibleCores;
  const processCpuMicros = afterProcessCpu.user + afterProcessCpu.system;
  const processCpuPercent = clampPercent(
    (processCpuMicros / (elapsedMs * 1_000)) / configuredCores * 100,
  );

  const systemTotalBytes = os.totalmem();
  const systemAvailableBytes = os.freemem();
  const totalBytes = cgroup.memory_limit_bytes ?? systemTotalBytes;
  const usedBytes = cgroup.memory_used_bytes ?? Math.max(0, systemTotalBytes - systemAvailableBytes);
  const availableBytes = Math.max(0, totalBytes - usedBytes);

  return {
    sampled_at: new Date().toISOString(),
    sample_duration_ms: Math.round(elapsedMs),
    environment: {
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
    },
    cpu: {
      system_usage_percent: calculateSystemCpuUsage(beforeCpu, afterCpu),
      configured_cores: Number(configuredCores.toFixed(2)),
      visible_cores: visibleCores,
      limit_source: cgroup.cpu_cores === null ? "system" : "cgroup",
      load_average: process.platform === "win32" ? null : os.loadavg().map((value) => Number(value.toFixed(2))),
    },
    memory: {
      used_bytes: usedBytes,
      available_bytes: availableBytes,
      total_bytes: totalBytes,
      usage_percent: totalBytes > 0 ? clampPercent((usedBytes / totalBytes) * 100) : null,
      limit_source: cgroup.memory_limit_bytes === null ? "system" : "cgroup",
    },
    process: {
      pid: process.pid,
      cpu_usage_percent: processCpuPercent,
      rss_bytes: process.memoryUsage().rss,
      heap_used_bytes: process.memoryUsage().heapUsed,
      heap_total_bytes: process.memoryUsage().heapTotal,
      external_bytes: process.memoryUsage().external,
      uptime_seconds: Math.round(process.uptime()),
    },
  };
}
