import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

export const LLM_AVAILABLE = client !== null;

const MODEL = process.env.ORION_MODEL ?? 'claude-sonnet-4-6';

export interface AskOptions {
  system: string;
  prompt: string;
  cacheSystem?: boolean;
  maxTokens?: number;
}

export async function ask(opts: AskOptions): Promise<string> {
  if (!client) throw new Error('LLM unavailable: set ANTHROPIC_API_KEY');

  const systemBlocks = opts.cacheSystem
    ? [{ type: 'text' as const, text: opts.system, cache_control: { type: 'ephemeral' as const } }]
    : opts.system;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: systemBlocks as any,
    messages: [{ role: 'user', content: opts.prompt }],
  });

  const text = response.content.find(b => b.type === 'text');
  return text && text.type === 'text' ? text.text : '';
}
