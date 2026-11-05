import { parserWebStream } from "https://esm.sh/stream-json/web";

import {
  getApiKey,
  getBaseUrl,
  getModel,
} from "https://cdn.jsdelivr.net/gh/trythursday/ai-for-all@main/src/client/storage.js";

const SYSTEM_PROMPT_URL = new URL("../SYSTEM_PROMPT.md", import.meta.url);
const OPENAI_URL = "https://esm.sh/jsr/@agent/openai@0.0.8";

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "refinement",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["readback", "add", "remove", "readiness"],
      properties: {
        readback: {
          type: "string",
          description: "The goal restated, and what the product is now.",
        },
        add: {
          type: "string",
          description: "One concrete thing to add, and where it goes.",
        },
        remove: {
          type: "string",
          description: "One concrete thing to cut, named or pointed at.",
        },
        readiness: {
          type: "string",
          description:
            "A few lines on how close this is to being shippable.",
        },
      },
    },
  },
};

let openaiPromise;
let systemPrompt;

export const preload = () => (openaiPromise ??= import(OPENAI_URL));

// The answer is written for one moment in time. Say which, in the reader's own
// timezone, rather than leaving the model to infer it from training data.
const now = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

async function loadSystemPrompt() {
  if (!systemPrompt) {
    systemPrompt = await (await fetch(SYSTEM_PROMPT_URL)).text();
  }

  return `${systemPrompt}\n\nThe current date and time, in the user's timezone, is ${now.format(new Date())}.`;
}

export async function generate({ goal, product, context, onPartial }) {
  const OpenAI = await preload();

  const client = OpenAI.credentials({
    apikey: getApiKey(),
    baseURL: `${(getBaseUrl() ?? "").replace(/\/+$/, "")}/`,
  });

  const trimmedProduct = product?.trim();
  const trimmedContext = context?.trim();

  const parts = [
    `Goal: ${goal}`,
    trimmedProduct ? `Product:\n${product}` : "Product: (empty)",
  ];

  if (trimmedContext) {
    parts.push(`<additional-context>\n${trimmedContext}\n</additional-context>`);
  }

  const user = parts.join("\n\n");

  // The reply is JSON that arrives in pieces, so it is parsed as it streams.
  // `stringChunk` is what lets the answer be typed out as it lands.
  const parser = parserWebStream({ streamValues: true, streamKeys: false });
  const writer = parser.writable.getWriter();
  const reader = parser.readable.getReader();

  const reply = {};
  let key = null;

  const collected = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();

        if (done) break;

        if (value.name === "keyValue") {
          key = value.value;
        } else if (value.name === "stringChunk") {
          reply[key] = (reply[key] ?? "") + value.value;
          onPartial?.({ ...reply });
        }
      }
    } catch {
      // Aborted mid-reply. Whatever landed is still in `reply`.
    }
  })();

  const stream = await OpenAI.stream(client, {
    method: "POST",
    path: "/chat/completions",
    body: {
      stream: true,
      model: getModel(),
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: "system", content: await loadSystemPrompt() },
        { role: "user", content: user },
      ],
    },
  });

  try {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";

      if (delta) await writer.write(delta);
    }

    await writer.close();
  } catch (error) {
    await writer.abort(error).catch(() => {});
    await collected;
    throw error;
  }

  await collected;

  return reply;
}
