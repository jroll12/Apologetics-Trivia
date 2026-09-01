import Anthropic from '@anthropic-ai/sdk';
import { Card } from '../game/cards';
import { buildRefereePrompt } from './rubric';

export class RefereeTimeoutError extends Error {}

export interface RefereeResult {
  score: number;
  tip: string;
}

const REFEREE_MODEL = 'claude-haiku-4-5-20251001';
const REFEREE_TIMEOUT_MS = 5000;

const SCORE_TOOL = {
  name: 'submit_score',
  description: "Submit the score and improvement tip for a player's apologetics response.",
  input_schema: {
    type: 'object' as const,
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 10, description: 'Score from 0-10' },
      tip: { type: 'string', description: 'One sentence noting what a stronger answer would include' },
    },
    required: ['score', 'tip'],
  },
};

export async function scoreResponse(
  client: Anthropic,
  card: Card,
  playerResponse: string
): Promise<RefereeResult> {
  const { system, user } = buildRefereePrompt(card, playerResponse);

  let timerId: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new RefereeTimeoutError('Referee call timed out')), REFEREE_TIMEOUT_MS);
  });

  const apiCall = client.messages.create({
    model: REFEREE_MODEL,
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: user }],
    tools: [SCORE_TOOL],
    tool_choice: { type: 'tool', name: 'submit_score' },
  });

  let response: Anthropic.Message;
  try {
    response = await Promise.race([apiCall, timeout]);
  } finally {
    clearTimeout(timerId!);
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUse) {
    throw new RefereeTimeoutError('Referee did not return a score');
  }

  const input = toolUse.input as { score: number; tip: string };
  return { score: input.score, tip: input.tip };
}
