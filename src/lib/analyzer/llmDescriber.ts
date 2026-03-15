import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface EndpointToDescribe {
  method: string;
  path: string;
  body: string; // function body source code
  handlerName?: string;
  file: string;
}

export interface SocketToDescribe {
  event: string;
  type: string;
  body: string;
  file: string;
}

/**
 * Batch-describe API endpoints using Claude.
 * Sends all endpoints in ONE prompt to minimize API calls.
 * Returns a map of index → description.
 * Falls back gracefully to empty strings on failure.
 */
export async function llmDescribeEndpoints(
  endpoints: EndpointToDescribe[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (endpoints.length === 0) return result;

  const ai = getClient();
  if (!ai) return result; // no API key — caller will use regex fallback

  // Trim bodies to avoid huge prompts — keep first 60 lines per endpoint
  const items = endpoints.map((ep, i) => {
    const trimmedBody = ep.body.split('\n').slice(0, 60).join('\n');
    return `### Endpoint ${i}
Method: ${ep.method}  Path: ${ep.path}  File: ${ep.file}
${ep.handlerName ? `Handler name: ${ep.handlerName}` : ''}
\`\`\`js
${trimmedBody}
\`\`\``;
  });

  const prompt = `You are a senior backend engineer reading source code.
For each numbered endpoint below, write a single concise sentence (max 12 words) that describes the BUSINESS PURPOSE of that endpoint — what it does for the user, not what code it runs.

Rules:
- Focus on business logic: e.g. "Authenticate user and return JWT token", "Book appointment with a doctor", "Process Stripe payment and send receipt email"
- Never say "find", "delete", "fetch" in a generic way — be specific to the domain
- If you can't determine the purpose, write a short educated guess based on path + method
- Respond ONLY with a JSON object: { "0": "description", "1": "description", ... }
- No markdown, no explanation, just raw JSON

${items.join('\n\n')}`;

  try {
    const message = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    // Extract JSON — handle cases where model wraps in ```json
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return result;

    const parsed: Record<string, string> = JSON.parse(jsonMatch[0]);
    for (const [key, val] of Object.entries(parsed)) {
      const idx = parseInt(key, 10);
      if (!isNaN(idx) && typeof val === 'string') result.set(idx, val.trim());
    }
  } catch {
    // silently fall back to regex descriptions
  }

  return result;
}

/**
 * Batch-describe Socket events using Claude.
 */
export async function llmDescribeSockets(
  sockets: SocketToDescribe[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (sockets.length === 0) return result;

  const ai = getClient();
  if (!ai) return result;

  const items = sockets.map((s, i) => {
    const trimmedBody = s.body.split('\n').slice(0, 40).join('\n');
    return `### Socket ${i}
Event: "${s.event}"  Type: ${s.type}  File: ${s.file}
\`\`\`js
${trimmedBody}
\`\`\``;
  });

  const prompt = `You are a senior backend engineer reading WebSocket source code.
For each numbered socket event below, write a single concise sentence (max 12 words) describing the BUSINESS PURPOSE.

Rules:
- Focus on what happens in the real world: e.g. "Broadcast new chat message to all room participants", "Notify user when their order status changes", "Join a collaborative document editing session"
- Respond ONLY with a JSON object: { "0": "description", "1": "description", ... }
- No markdown, no explanation, just raw JSON

${items.join('\n\n')}`;

  try {
    const message = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return result;

    const parsed: Record<string, string> = JSON.parse(jsonMatch[0]);
    for (const [key, val] of Object.entries(parsed)) {
      const idx = parseInt(key, 10);
      if (!isNaN(idx) && typeof val === 'string') result.set(idx, val.trim());
    }
  } catch {
    // silently fall back
  }

  return result;
}
