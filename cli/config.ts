import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type AgentName = "claude" | "codex";

export interface DirectConfig {
  convexUrl: string;
  projectId: string;
  key: string;
  name: string;
  url: string;
  agent: AgentName;
  command?: string[];
}

export const CONFIG_FILE = ".direct.json";
export const DEFAULT_CONVEX_URL = "https://rightful-reindeer-55.convex.cloud";
export const BIN_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../bin/direct.mjs");

export function configPath(dir = process.cwd()): string {
  return resolve(dir, CONFIG_FILE);
}

export function loadConfig(path: string): DirectConfig {
  if (!existsSync(path)) throw new Error(`No ${CONFIG_FILE} at ${path}. Run "direct init" in your project first.`);
  return JSON.parse(readFileSync(path, "utf8")) as DirectConfig;
}

export function saveConfig(path: string, config: DirectConfig) {
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}
