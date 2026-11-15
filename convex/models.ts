export type Provider = "openai" | "anthropic";

const OPENAI_PREFERENCE = [/^gpt-5\.5$/, /^gpt-5\.4$/, /^gpt-5\.2$/, /^gpt-5\.1$/, /^gpt-5$/, /^gpt-4\.1$/, /^gpt-4o$/];

export async function verifyKey(provider: Provider, apiKey: string): Promise<string> {
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    if (response.status === 401) throw new Error("OpenAI didn't accept that key");
    if (!response.ok) throw new Error(`OpenAI answered ${response.status}`);
    const ids = ((await response.json()) as { data: { id: string }[] }).data.map((model) => model.id);
    for (const pattern of OPENAI_PREFERENCE) {
      const found = ids.find((id) => pattern.test(id));
      if (found) return found;
    }
    throw new Error("This OpenAI key has no GPT model Clay can use");
  }
  const response = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  });
  if (response.status === 401) throw new Error("Anthropic didn't accept that key");
  if (!response.ok) throw new Error(`Anthropic answered ${response.status}`);
  const models = ((await response.json()) as { data: { id: string; created_at: string }[] }).data;
  const pick = (family: string) =>
    models.filter((model) => model.id.includes(family)).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const chosen = pick("sonnet") ?? pick("opus") ?? models[0];
  if (!chosen) throw new Error("This Anthropic key has no Claude model Clay can use");
  return chosen.id;
}

export async function complete(
  provider: Provider,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  imageUrl: string | null,
): Promise<string> {
  if (provider === "openai") {
    const content: unknown[] = [{ type: "input_text", text: user }];
    if (imageUrl) content.push({ type: "input_image", image_url: imageUrl });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: system,
        input: [{ role: "user", content }],
        text: { format: { type: "json_object" } },
      }),
    });
    const body = (await response.json()) as { error?: { message: string }; output?: { type: string; content?: { type: string; text?: string }[] }[] };
    if (!response.ok) throw new Error(body.error?.message ?? `OpenAI answered ${response.status}`);
    const text = (body.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("");
    if (!text) throw new Error("OpenAI returned no answer");
    return text;
  }
  const content: unknown[] = [];
  if (imageUrl) content.push({ type: "image", source: { type: "url", url: imageUrl } });
  content.push({ type: "text", text: user });
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 8000, system, messages: [{ role: "user", content }] }),
  });
  const body = (await response.json()) as { error?: { message: string }; content?: { type: string; text?: string }[] };
  if (!response.ok) throw new Error(body.error?.message ?? `Anthropic answered ${response.status}`);
  const text = (body.content ?? []).filter((part) => part.type === "text").map((part) => part.text ?? "").join("");
  if (!text) throw new Error("Claude returned no answer");
  return text;
}

export function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}
