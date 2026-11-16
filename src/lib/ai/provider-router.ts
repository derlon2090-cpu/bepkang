export type ProviderChoice = "auto" | "openai" | "deepseek";

type TextRequest = { prompt: string; provider?: ProviderChoice; deep?: boolean; image?: { base64: string; mimeType: string } };

function configured(provider: ProviderChoice) {
  return provider === "openai" ? Boolean(process.env.OPENAI_API_KEY) : Boolean(process.env.DEEPSEEK_API_KEY);
}

export function chooseProvider({ provider = "auto", image, deep = false }: Pick<TextRequest, "provider" | "image" | "deep">) {
  if (provider !== "auto" && configured(provider)) return provider;
  if (image && configured("openai")) return "openai";
  if (configured("deepseek")) return "deepseek";
  if (configured("openai")) return "openai";
  throw new Error("لا يوجد مفتاح مزود ذكاء اصطناعي مهيأ.");
}

export async function generateText({ prompt, provider = "auto", deep = false, image }: TextRequest) {
  const selected = chooseProvider({ provider, deep, image });
  const isDeepSeek = selected === "deepseek";
  const apiKey = isDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
  const url = isDeepSeek ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const model = isDeepSeek ? (deep ? "deepseek-reasoner" : "deepseek-chat") : (deep ? "gpt-4o" : "gpt-4o-mini");
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  if (image && !isDeepSeek) content.push({ type: "image_url", image_url: { url: "data:" + image.mimeType + ";base64," + image.base64 } });
  if (image && isDeepSeek) throw new Error("DeepSeek text routing does not accept images; choose OpenAI or Gemini for vision.");
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + apiKey }, body: JSON.stringify({ model, messages: [{ role: "user", content }], response_format: { type: "json_object" } }) });
  if (!response.ok) throw new Error(selected + " API error " + response.status + ": " + await response.text());
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "";
}

export async function embedWithOpenAI(text: string) {
  if (!process.env.OPENAI_API_KEY) return null;
  const response = await fetch("https://api.openai.com/v1/embeddings", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + process.env.OPENAI_API_KEY }, body: JSON.stringify({ model: "text-embedding-3-small", input: text }) });
  if (!response.ok) throw new Error("OpenAI embedding error " + response.status);
  const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
  return payload.data?.[0]?.embedding ?? null;
}
