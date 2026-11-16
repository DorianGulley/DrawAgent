export const MODEL = process.env.CLAY_MODEL || "gpt-5.5";

export async function complete(system: string, user: string, images: string[], maxTokens = 8000): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Clay's model key isn't set up on the server");
  const content: unknown[] = [{ type: "input_text", text: user }];
  for (const url of images) content.push({ type: "input_image", image_url: url });
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      instructions: system,
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } },
      max_output_tokens: maxTokens * 4,
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
  if (!text) throw new Error("The model returned no answer");
  return text;
}

export function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}
