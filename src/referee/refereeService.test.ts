import Anthropic from '@anthropic-ai/sdk';
import { scoreResponse, RefereeTimeoutError } from './refereeService';
import { Card } from '../game/cards';

const card: Card = {
  id: 'cb-test',
  type: 'COMEBACK',
  topic: 'problem-of-evil',
  prompt: 'Why does a loving God allow suffering?',
};

function fakeToolUseResponse(score: number, tip: string) {
  return {
    content: [{ type: 'tool_use', id: 'tool_1', name: 'submit_score', input: { score, tip } }],
  };
}

describe('scoreResponse', () => {
  it('parses the score and tip from the tool_use response', async () => {
    const fakeClient = {
      messages: {
        create: jest.fn().mockResolvedValue(fakeToolUseResponse(8, 'Mention the free will defense.')),
      },
    } as unknown as Anthropic;

    const result = await scoreResponse(fakeClient, card, 'Because of free will.');
    expect(result).toEqual({ score: 8, tip: 'Mention the free will defense.' });
  });

  it('calls the API with the card and response in the prompt, forcing the submit_score tool', async () => {
    const create = jest.fn().mockResolvedValue(fakeToolUseResponse(5, 'tip'));
    const fakeClient = { messages: { create } } as unknown as Anthropic;

    await scoreResponse(fakeClient, card, 'my response');

    const callArgs = create.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain('my response');
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'submit_score' });
    // rubric.test.ts proves the guardrails exist in the built prompt; this
    // proves they actually reach the API. Without it the whole system prompt
    // could be dropped from the call and every test would still pass.
    expect(callArgs.system).toMatch(/scoring tool, not a spiritual authority/i);
    expect(callArgs.system).toMatch(/untrusted/i);
  });

  it('throws RefereeTimeoutError if the API call takes too long', async () => {
    const fakeClient = {
      messages: {
        create: jest.fn(() => new Promise(() => {})), // never resolves
      },
    } as unknown as Anthropic;

    await expect(scoreResponse(fakeClient, card, 'slow response')).rejects.toThrow(
      RefereeTimeoutError
    );
  }, 7000);

  it('throws RefereeTimeoutError if the response has no tool_use block', async () => {
    const fakeClient = {
      messages: {
        create: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'oops' }] }),
      },
    } as unknown as Anthropic;

    await expect(scoreResponse(fakeClient, card, 'x')).rejects.toThrow(RefereeTimeoutError);
  });

  // The Anthropic API does not hard-enforce a tool's JSON schema at the
  // model-output level, so anything landing in `toolUse.input` is untrusted.
  // A bad score must route to the host-manual fallback (RefereeTimeoutError)
  // rather than being written into the leaderboard — e.g. a string score would
  // turn `scores[p] + result.score` into string concatenation.
  describe.each([
    ['a non-numeric score', { score: '8', tip: 'ok' }],
    ['a score above the 0-10 range', { score: 500, tip: 'ok' }],
    ['a negative score', { score: -3, tip: 'ok' }],
    ['a non-integer score', { score: 7.5, tip: 'ok' }],
    ['a NaN score', { score: Number.NaN, tip: 'ok' }],
    ['a missing score', { tip: 'ok' }],
    ['a non-string tip', { score: 5, tip: 42 }],
    ['an empty tip', { score: 5, tip: '   ' }],
    ['a missing tip', { score: 5 }],
    ['a non-object input', 'not an object'],
  ])('when the model returns %s', (_label, input) => {
    it('throws RefereeTimeoutError instead of corrupting the score', async () => {
      const fakeClient = {
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: 'tool_use', id: 'tool_1', name: 'submit_score', input }],
          }),
        },
      } as unknown as Anthropic;

      await expect(scoreResponse(fakeClient, card, 'x')).rejects.toThrow(RefereeTimeoutError);
    });
  });

  it('accepts the boundary scores 0 and 10', async () => {
    for (const score of [0, 10]) {
      const fakeClient = {
        messages: {
          create: jest.fn().mockResolvedValue(fakeToolUseResponse(score, 'a tip')),
        },
      } as unknown as Anthropic;

      await expect(scoreResponse(fakeClient, card, 'x')).resolves.toEqual({
        score,
        tip: 'a tip',
      });
    }
  });
});
