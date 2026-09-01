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
});
