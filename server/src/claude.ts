import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { ImageInput } from "@rootsight/shared/schema";

// Env is read lazily so index.ts can load server/.env first.
export const useMock = () => process.env.USE_MOCK !== "false";

let client: Anthropic | undefined;

export function imageBlock({ imageBase64, mediaType }: ImageInput): Anthropic.ImageBlockParam {
  return { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } };
}

/**
 * One Claude call with structured outputs, validated by `schema`.
 * On validation failure, retries once with the error appended, then throws (-> 502).
 */
export async function askJson<S extends z.ZodType>(
  schema: S,
  system: string,
  content: Anthropic.ContentBlockParam[],
): Promise<z.infer<S>> {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  let error = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote: Anthropic.TextBlockParam[] = error
      ? [{ type: "text", text: `Your previous answer failed validation:\n${error}\nReturn corrected JSON.` }]
      : [];
    // API/auth errors throw straight through (the SDK already retries 429/5xx).
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: [...content, ...retryNote] }],
      // TODO(claude-owner): tune effort (low = fastest for live demos).
      output_config: { format: zodOutputFormat(schema), effort: "low" },
    });
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {}
    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;
    error = res.stop_reason === "end_turn" ? parsed.error.message : `stop_reason: ${res.stop_reason}`;
  }
  throw new Error(`Claude output failed validation twice: ${error}`);
}
