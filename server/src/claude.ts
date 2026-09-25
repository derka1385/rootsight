import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { ImageInput } from "@rootsight/shared/schema";

// Env is read lazily so index.ts can load server/.env first.
export const useMock = () => process.env.USE_MOCK !== "false";

let client: Anthropic | undefined;

// The full PlantProfile (with `visual`) is too big for strict structured outputs ("compiled grammar is
// too large"), so the JSON Schema goes in the prompt instead and zod enforces it on the answer
// (see the retry in askJson). Bounds and patterns stay in the text as hints.
const schemaText = new WeakMap<z.ZodType, string>();
function jsonInstructions(schema: z.ZodType): string {
  let t = schemaText.get(schema);
  if (!t) schemaText.set(schema, (t = JSON.stringify(zodOutputFormat(schema).schema)));
  return `\n\nReply with ONLY one JSON object, no prose and no code fences, valid against this JSON Schema:\n${t}`;
}

/** Tolerates stray prose or ```json fences around the object. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

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
  effort: NonNullable<Anthropic.Messages.OutputConfig["effort"]> = "low",
): Promise<z.infer<S>> {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  let error = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote: Anthropic.TextBlockParam[] = error
      ? [{ type: "text", text: `Your previous answer failed validation:\n${error}\nReturn corrected JSON.` }]
      : [];
    // API/auth errors throw straight through (the SDK already retries 429/5xx).
    const res = await client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: effort === "low" ? 16000 : 32000,
      system: system + jsonInstructions(schema),
      messages: [{ role: "user", content: [...content, ...retryNote] }],
      // "max" for the profile the 3D is built from; "low" keeps demo Q&A fast.
      output_config: { effort },
    }).finalMessage(); // streaming: max effort can exceed the SDK non-streaming limit
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = schema.safeParse(extractJson(text));
    if (parsed.success) return parsed.data;
    error = res.stop_reason === "end_turn" ? parsed.error.message : `stop_reason: ${res.stop_reason}`;
  }
  throw new Error(`Claude output failed validation twice: ${error}`);
}
