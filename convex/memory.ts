import { Supermemory } from "supermemory";

function client(): Supermemory | null {
  return process.env.SUPERMEMORY_API_KEY ? new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY }) : null;
}

export function namespaceFor(workspaceId: string): string {
  return `clay_workspace_${workspaceId}`;
}

export async function recall(workspaceId: string, query: string): Promise<string> {
  const memory = client();
  if (!memory) return "";
  try {
    const namespace = namespaceFor(workspaceId);
    const [{ results }, { profile }] = await Promise.all([
      memory.search(namespace, { query: query.slice(0, 500) || "design preferences", limit: 6 }),
      memory.profile(namespace),
    ]);
    const facts = [...(profile?.static ?? []), ...(profile?.dynamic ?? [])].slice(0, 10);
    const found = results.map((result) => result.memory ?? result.chunk).filter((text): text is string => Boolean(text));
    const lines = [...new Set([...facts, ...found])].slice(0, 14);
    return lines.length ? lines.map((line) => `- ${line}`).join("\n") : "";
  } catch (error) {
    console.warn("Supermemory recall failed", error instanceof Error ? error.message : error);
    return "";
  }
}

export async function remember(workspaceId: string, turn: string, metadata: Record<string, string>) {
  const memory = client();
  if (!memory) return;
  try {
    await memory.add(namespaceFor(workspaceId), { content: turn, id: "conversation", metadata: { source: "clay", ...metadata } });
  } catch (error) {
    console.warn("Supermemory add failed", error instanceof Error ? error.message : error);
  }
}
