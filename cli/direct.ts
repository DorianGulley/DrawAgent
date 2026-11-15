import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./api";
import { AgentName, BIN_PATH, CONFIG_FILE, DEFAULT_CONVEX_URL, configPath, loadConfig, saveConfig } from "./config";
import { runMcpServer } from "./mcp";
import { agentCommand, agentPrompt, watch } from "./watch";

const HELP = `direct: connect a project's coding agent to Direct

  direct init --url <live url> [--name <name>] [--agent claude|codex] [--emoji 🌱]
      Register this directory's app with Direct and write ${CONFIG_FILE} (keep it out of git).
  direct config [--url <live url>] [--agent claude|codex]
      Change the live URL or agent for this project.
  direct watch [--once]
      Wait for feedback from the phone and launch the configured agent headless for each item.
  direct setup claude|codex
      Print the command that adds the Direct MCP server to Claude Code or Codex for interactive use.
  direct mcp [--config <path>]
      Run the Direct MCP server on stdio (agents launch this; you rarely run it yourself).
  direct status
      Show this project's pending feedback.

Options: --config <path to ${CONFIG_FILE}> (defaults to ./${CONFIG_FILE})`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: "string" },
    url: { type: "string" },
    name: { type: "string" },
    agent: { type: "string" },
    emoji: { type: "string" },
    convex: { type: "string" },
    once: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

const [command, arg] = positionals;
const file = values.config ? resolve(values.config) : configPath();
const shellQuote = (value: string) => (/^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`);

async function main() {
  switch (command) {
    case "init": {
      if (!values.url) throw new Error("--url is required (your deployed preview or tunnel URL)");
      if (existsSync(file)) throw new Error(`${file} already exists`);
      const agent = (values.agent ?? "claude") as AgentName;
      if (agent !== "claude" && agent !== "codex") throw new Error("--agent must be claude or codex");
      const convexUrl = values.convex ?? process.env.DIRECT_CONVEX_URL ?? DEFAULT_CONVEX_URL;
      const name = values.name ?? basename(dirname(file));
      const { projectId, key } = await new ConvexHttpClient(convexUrl).mutation(api.projects.create, { name, url: values.url, emoji: values.emoji, agent });
      saveConfig(file, { convexUrl, projectId, key, name, url: values.url, agent });
      console.log(`Connected "${name}" to Direct. It now shows up on your phone.\nWrote ${file} (contains the project key; it is git-ignored only if you ignore it).\nNext: direct watch`);
      return;
    }
    case "config": {
      const config = loadConfig(file);
      if (values.agent && values.agent !== "claude" && values.agent !== "codex") throw new Error("--agent must be claude or codex");
      if (!values.url && !values.agent) throw new Error("Pass --url and/or --agent");
      await new ConvexHttpClient(config.convexUrl).mutation(api.agent.updateProject, { key: config.key, url: values.url, agent: values.agent });
      saveConfig(file, { ...config, url: values.url ?? config.url, agent: (values.agent as AgentName | undefined) ?? config.agent });
      console.log(`Updated "${config.name}".`);
      return;
    }
    case "mcp":
      return runMcpServer(loadConfig(file), file);
    case "watch":
      return watch(loadConfig(file), file, { once: Boolean(values.once) });
    case "status": {
      const config = loadConfig(file);
      console.log(await new ConvexHttpClient(config.convexUrl).query(api.agent.pending, { key: config.key }));
      return;
    }
    case "setup": {
      const config = loadConfig(file);
      const server = [process.execPath, BIN_PATH, "mcp", "--config", file];
      if (arg === "claude") {
        console.log("Run this in the project directory to add Direct to Claude Code:\n");
        console.log(["claude", "mcp", "add", "direct", "--scope", "local", "--", ...server].map(shellQuote).join(" "));
      } else if (arg === "codex") {
        console.log("Run this to add Direct to Codex:\n");
        console.log(["codex", "mcp", "add", "direct", "--", ...server].map(shellQuote).join(" "));
        console.log("\nor add to ~/.codex/config.toml:\n");
        console.log(`[mcp_servers.direct]\ncommand = ${JSON.stringify(server[0])}\nargs = ${JSON.stringify(server.slice(1))}`);
      } else throw new Error("Usage: direct setup claude|codex");
      console.log(`\n"direct watch" launches ${config.agent} like this (the prompt is shown as {prompt}):\n`);
      console.log(agentCommand(config, file, "{prompt}").map(shellQuote).join(" "));
      console.log("\nPrompt template:\n" + agentPrompt("<feedback id>", config));
      return;
    }
    default:
      console.log(HELP);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
