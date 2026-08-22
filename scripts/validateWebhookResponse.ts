import * as fs from "fs";

const args = process.argv.slice(2);
let responsePath = "";
let maxRetries = 5;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--response" && i + 1 < args.length) {
    responsePath = args[i + 1];
    i++;
  } else if (args[i] === "--max-retries" && i + 1 < args.length) {
    maxRetries = parseInt(args[i + 1], 10);
    i++;
  }
}

export interface WebhookResponse {
  status: "success" | "skip" | "error";
  slug?: string;
  sectionsUpdated?: number;
  error?: string;
}

export function validateWebhookResponse(raw: unknown): WebhookResponse {
  let target = raw;
  if (Array.isArray(target)) {
    target = target[0];
  }

  if (!target || typeof target !== "object") {
    return { status: "error", error: "Response is not an object or array" };
  }

  let obj = target as Record<string, any>;

  // Unwrap the n8n/Supabase { success, data: {...} } envelope so we can see the doc payload.
  if (
    obj.data &&
    typeof obj.data === "object" &&
    !Array.isArray(obj.data) &&
    (obj.data.slug || obj.data.content || obj.data.title)
  ) {
    obj = obj.data as Record<string, any>;
  }

  if (obj.error) {
    return { status: "error", error: String(obj.error) };
  }

  const content = obj.content && typeof obj.content === "object" ? obj.content : undefined;

  // The AI doc step emits this sentinel title (and isError) when it cannot parse the model output.
  if (
    obj.isError === true ||
    (content && content.isError === true) ||
    obj.title === "Documentation Parsing Failed" ||
    (content && content.title === "Documentation Parsing Failed")
  ) {
    const reason =
      obj.description ||
      (content && content.description) ||
      "Documentation parsing failed (AI output could not be turned into valid JSON)";
    return { status: "error", error: String(reason) };
  }

  if (obj.skip === true || obj.isSkip === true) {
    return { status: "skip", slug: obj.slug as string | undefined };
  }

  if (obj.slug && (content || obj.sections)) {
    const sections = content?.sections || obj.sections;
    const sectionsCount = Array.isArray(sections) ? sections.length : 0;
    return {
      status: "success",
      slug: String(obj.slug),
      sectionsUpdated: sectionsCount,
    };
  }

  if (obj.status === "success" || obj.sectionsUpdated !== undefined) {
    return {
      status: "success",
      slug: obj.slug as string | undefined,
      sectionsUpdated: typeof obj.sectionsUpdated === "number" ? obj.sectionsUpdated : undefined,
    };
  }

  return { status: "error", error: "Unrecognized response shape" };
}

export function assertWebhookSuccess(response: WebhookResponse, attempt: number, max: number): void {
  if (response.status === "error") {
    const msg = `Webhook error (attempt ${attempt}/${max}): ${response.error}`;
    if (attempt >= max) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg + " — will retry");
  } else if (response.status === "skip") {
    console.log(`n8n skipped doc update (no significant changes detected). Slug: ${response.slug ?? "unknown"}`);
  } else {
    console.log(
      `Doc update successful. Slug: ${response.slug ?? "unknown"}, sections updated: ${response.sectionsUpdated ?? "unknown"}`
    );
  }
}

function main() {
  if (!responsePath) {
    console.error("Error: --response parameter is required.");
    process.exit(1);
  }

  if (!fs.existsSync(responsePath)) {
    console.error(`Response file not found: ${responsePath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(responsePath, "utf-8").trim();
  if (!rawText) {
    console.log("n8n returned an empty response — webhook was received and is processing asynchronously.");
    process.exit(0);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    console.log(`n8n response could not be parsed as JSON (got: ${rawText.substring(0, 200)}). Webhook was sent successfully.`);
    process.exit(0);
  }

  const response = validateWebhookResponse(raw);
  assertWebhookSuccess(response, 1, maxRetries);
}

main();
