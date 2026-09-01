import { buildRefereePrompt } from './rubric';
import { Card } from '../game/cards';

const comebackCard: Card = {
  id: 'cb-test',
  type: 'COMEBACK',
  topic: 'problem-of-evil',
  prompt: 'A friend says: "If God is loving, why does he allow suffering?" How do you respond?',
};

const steelmanCard: Card = {
  id: 'sm-test',
  type: 'STEELMAN',
  topic: 'pluralism',
  prompt: 'Argue as convincingly as you can for religious pluralism.',
};

describe('buildRefereePrompt', () => {
  it('never lets the referee speak as though it personally believes something', () => {
    const { system } = buildRefereePrompt(comebackCard, 'Because free will requires...');
    expect(system).toMatch(/scoring tool, not a spiritual authority/i);
  });

  it('includes the card prompt and the player response in the user message', () => {
    const response = 'Because free will requires the possibility of real choices.';
    const { user } = buildRefereePrompt(comebackCard, response);
    expect(user).toContain(comebackCard.prompt);
    expect(user).toContain(response);
  });

  it('scores STEELMAN rounds on fairness to the opposing view, not agreement', () => {
    const { system } = buildRefereePrompt(steelmanCard, 'All paths lead to the same truth...');
    expect(system).toMatch(/fairly and persuasively/i);
  });

  it('scores COMEBACK rounds on accuracy, charity, and clarity', () => {
    const { system } = buildRefereePrompt(comebackCard, 'Because free will...');
    expect(system).toMatch(/accuracy/i);
    expect(system).toMatch(/charity/i);
    expect(system).toMatch(/clarity/i);
  });
});
