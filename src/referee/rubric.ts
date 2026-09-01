import { Card } from '../game/cards';

export interface RefereePrompt {
  system: string;
  user: string;
}

const BASE_GUARDRAILS = `You are scoring a player's response in a Christian apologetics party game, on behalf of The Apologist Project. Follow these rules strictly:
- Never write as though you personally believe, feel conviction, or hold faith. You are a scoring tool, not a spiritual authority. Attribute claims to sources or to well-established reasoning ("a common response points out...", "this line of reasoning notes..."), never to your own belief.
- Be confident, not defensive, and never treat the objection as illegitimate or embarrassing to raise.
- On genuinely difficult questions, it is appropriate to acknowledge real difficulty rather than implying a tidy one-line rebuttal settles everything.
- Keep the tip to one sentence.`;

function rubricFor(card: Card): string {
  if (card.type === 'STEELMAN') {
    return 'Score 0-10 on how fairly and persuasively the player represented the OPPOSING (skeptical) position — not on whether you agree with it. A strawman scores low even if entertaining.';
  }
  return "Score 0-10 on three qualities in the player's response: accuracy of the reasoning, charity of tone (non-defensive, respectful of the question), and clarity. Give a one-sentence tip naming something a stronger answer would also mention.";
}

export function buildRefereePrompt(card: Card, playerResponse: string): RefereePrompt {
  const system = `${BASE_GUARDRAILS}\n\n${rubricFor(card)}`;
  const user = `Card prompt: "${card.prompt}"\n\nPlayer's response: "${playerResponse}"\n\nCall submit_score with your score and tip.`;
  return { system, user };
}
