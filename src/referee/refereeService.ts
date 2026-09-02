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

  if (!isValidRefereeResult(toolUse.input)) {
    // Deliberately a RefereeTimeoutError: from the host's point of view an
    // unusable referee answer is the same situation as no answer at all, and
    // this error type is what routes the round to the host-manual fallback
    // (see HostBoard's `handleResolve`) instead of an HTTP 500.
    throw new RefereeTimeoutError('Referee returned a malformed score');
  }

  return { score: toolUse.input.score, tip: toolUse.input.tip };
}

/**
 * The Anthropic API does not hard-enforce a tool's `input_schema` at the
 * model-output level, so `toolUse.input` is untrusted. An out-of-range or
 * non-numeric score would corrupt the leaderboard — `ApologeticsGame`'s
 * `resolveRound` does `(scores[id] ?? 0) + result.score`, which silently turns
 * into string concatenation for a string score.
 *
 * Out-of-range scores are rejected rather than clamped: a 500 or a -3 is far
 * more likely to mean the model malfunctioned than to be a meaningful judgment
 * worth salvaging, and rejecting hands the round to a human.
 */
function isValidRefereeResult(input: unknown): input is RefereeResult {
  if (typeof input !== 'object' || input === null) return false;

  const { score, tip } = input as { score?: unknown; tip?: unknown };

  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 10) {
    return false;
  }
  if (typeof tip !== 'string' || tip.trim() === '') {
    return false;
  }

  return true;
}
