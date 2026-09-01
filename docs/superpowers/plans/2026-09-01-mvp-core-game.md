# Apologetics Party Game — MVP Core Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable, same-room, shared-screen party game — a boardgame.io engine driving three card types (Quick Draw, Steelman, Comeback), a real 15-card free Starter Deck, and a working AI referee — that a real small group can playtest end to end.

**Architecture:** A boardgame.io `Game` definition holds all round/scoring state and is served by a boardgame.io `Server` (Koa-based) that also exposes a custom `/referee/score` endpoint; that endpoint calls the Anthropic API with a rubric-and-guardrail prompt built per card type. Two React "board" components (`HostBoard`, `PlayerBoard`) render the same game state differently depending on whether the client is the shared screen or a player's phone, connected over boardgame.io's `SocketIO` multiplayer transport. Quick Draw rounds are scored deterministically (no AI call); Steelman/Comeback rounds are scored by the AI referee, with a host-manual fallback if it's slow or unavailable.

**Tech Stack:** TypeScript, React 18, boardgame.io (game engine + Koa server + SocketIO transport), `@anthropic-ai/sdk` (Claude Haiku 4.5 for fast referee scoring), Vite (client dev/build), Jest + ts-jest + Testing Library + supertest (tests).

**Spec:** [docs/superpowers/specs/2026-09-01-apologetics-party-game-design.md](../specs/2026-09-01-apologetics-party-game-design.md)

## Global Constraints

- Same-room, shared-screen play only — no remote/mixed multiplayer (spec Section 9).
- No accounts, premium content, or billing integration in this plan — a single free Starter Deck only (spec Section 9).
- The AI referee must never phrase feedback as though it personally believes or holds faith; it cites sources/reasoning instead, never its own conviction (spec Section 5).
- AI referee calls must fall back to host-manual scoring within 5 seconds of no response — a live room will not wait on a slow API call (spec Section 5).
- Node.js 18+ required (native `fetch` is used in `HostBoard` and the match-creation script).

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `jest.setup.ts`
- Create: `.gitignore`
- Test: `src/setup.test.ts`

**Interfaces:**
- Produces: a working `npm test` command and TypeScript compilation for every later task.

This task has no application behavior to drive out via red/green — it's tooling. It ends with a trivial sanity test proving the pipeline (TypeScript + Jest + React) actually works, which every later task depends on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "apologist-game",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "jest",
    "dev:server": "ts-node src/server/index.ts",
    "dev:client": "vite",
    "create-match": "ts-node scripts/create-match.ts"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install boardgame.io react react-dom @anthropic-ai/sdk
npm install -D typescript ts-node ts-jest jest jest-environment-jsdom \
  @types/jest @types/node @types/react @types/react-dom \
  @testing-library/react @testing-library/jest-dom \
  supertest @types/supertest \
  vite @vitejs/plugin-react
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 4: Create `jest.config.js` and `jest.setup.ts`**

`jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEach: [],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
```

`jest.setup.ts`:

```ts
import '@testing-library/jest-dom';
```

React component test files (Tasks 7–8) will need `/** @jest-environment jsdom */` as the first line of the file, since the project-wide default environment is `node` (correct for the game-logic and server tests, which are most of this plan).

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 6: Write the pipeline sanity test**

`src/setup.test.ts`:

```ts
describe('project scaffolding', () => {
  it('runs TypeScript through Jest correctly', () => {
    const sum: number = 1 + 1;
    expect(sum).toBe(2);
  });
});
```

- [ ] **Step 7: Run the test suite and confirm it passes**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json jest.config.js jest.setup.ts .gitignore src/setup.test.ts
git commit -m "chore: scaffold TypeScript/Jest/Vite project"
```

---

## Task 2: Card data model and Starter Deck content

**Files:**
- Create: `src/game/cards.ts`
- Test: `src/game/cards.test.ts`

**Interfaces:**
- Produces:
  - `type CardType = 'QUICK_DRAW' | 'STEELMAN' | 'COMEBACK'`
  - `interface Card { id: string; type: CardType; topic: string; prompt: string; choices?: string[]; correctChoiceIndex?: number }`
  - `interface RoundResult { playerID: string; score: number; tip: string }`
  - `const STARTER_DECK: Card[]` — 15 cards, in fixed order: indices 0–4 are `QUICK_DRAW`, 5–9 are `STEELMAN`, 10–14 are `COMEBACK`.
  - `function scoreQuickDraw(card: Card, responses: Record<string, string>): RoundResult[]`

- [ ] **Step 1: Write the failing tests**

`src/game/cards.test.ts`:

```ts
import { STARTER_DECK, scoreQuickDraw, Card } from './cards';

describe('STARTER_DECK', () => {
  it('has 15 cards: 5 of each type, in QUICK_DRAW, STEELMAN, COMEBACK order', () => {
    expect(STARTER_DECK).toHaveLength(15);
    expect(STARTER_DECK.slice(0, 5).every((c) => c.type === 'QUICK_DRAW')).toBe(true);
    expect(STARTER_DECK.slice(5, 10).every((c) => c.type === 'STEELMAN')).toBe(true);
    expect(STARTER_DECK.slice(10, 15).every((c) => c.type === 'COMEBACK')).toBe(true);
  });

  it('every QUICK_DRAW card has choices and a valid correctChoiceIndex', () => {
    const quickDrawCards = STARTER_DECK.filter((c) => c.type === 'QUICK_DRAW');
    for (const card of quickDrawCards) {
      expect(card.choices?.length).toBeGreaterThan(1);
      expect(card.correctChoiceIndex).toBeGreaterThanOrEqual(0);
      expect(card.correctChoiceIndex).toBeLessThan(card.choices!.length);
    }
  });

  it('every card has a unique, non-empty id and prompt', () => {
    const ids = STARTER_DECK.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const card of STARTER_DECK) {
      expect(card.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe('scoreQuickDraw', () => {
  const card: Card = {
    id: 'test-card',
    type: 'QUICK_DRAW',
    topic: 'test',
    prompt: 'Test prompt?',
    choices: ['A', 'B', 'C'],
    correctChoiceIndex: 1,
  };

  it('awards 10 points to players who chose the correct index', () => {
    const results = scoreQuickDraw(card, { '0': '1', '1': '0' });
    expect(results).toContainEqual({ playerID: '0', score: 10, tip: 'Correct!' });
  });

  it('awards 0 points and names the correct choice for wrong answers', () => {
    const results = scoreQuickDraw(card, { '1': '0' });
    expect(results).toContainEqual({
      playerID: '1',
      score: 0,
      tip: 'The correct answer was "B".',
    });
  });

  it('returns one result per response, regardless of how many players answered', () => {
    const results = scoreQuickDraw(card, { '0': '1' });
    expect(results).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- cards.test.ts`
Expected: FAIL — `Cannot find module './cards'`.

- [ ] **Step 3: Implement `src/game/cards.ts`**

```ts
export type CardType = 'QUICK_DRAW' | 'STEELMAN' | 'COMEBACK';

export interface Card {
  id: string;
  type: CardType;
  topic: string;
  prompt: string;
  choices?: string[];
  correctChoiceIndex?: number;
}

export interface RoundResult {
  playerID: string;
  score: number;
  tip: string;
}

export const STARTER_DECK: Card[] = [
  // Quick Draw (trivia, ~15s, scored deterministically)
  {
    id: 'qd-1',
    type: 'QUICK_DRAW',
    topic: 'historicity',
    prompt:
      'Which 1st-century Jewish historian, writing outside the New Testament, mentions Jesus and his execution under Pontius Pilate?',
    choices: ['Julius Caesar', 'Flavius Josephus', 'Marcus Aurelius', 'Plato'],
    correctChoiceIndex: 1,
  },
  {
    id: 'qd-2',
    type: 'QUICK_DRAW',
    topic: 'resurrection',
    prompt:
      "According to the early creed recorded in 1 Corinthians 15, the risen Jesus was reported to appear to over how many people at once?",
    choices: ['12', '500', '3', '70'],
    correctChoiceIndex: 1,
  },
  {
    id: 'qd-3',
    type: 'QUICK_DRAW',
    topic: 'pluralism',
    prompt:
      "The view that 'all religions are ultimately pointing to the same truth' is usually called what?",
    choices: ['Monotheism', 'Apologetics', 'Religious pluralism', 'Orthodoxy'],
    correctChoiceIndex: 2,
  },
  {
    id: 'qd-4',
    type: 'QUICK_DRAW',
    topic: 'science-faith',
    prompt:
      'Which 17th-century scientist who helped found modern physics was also a devout Christian who wrote extensively on theology?',
    choices: ['Charles Darwin', 'Richard Dawkins', 'Isaac Newton', 'Carl Sagan'],
    correctChoiceIndex: 2,
  },
  {
    id: 'qd-5',
    type: 'QUICK_DRAW',
    topic: 'problem-of-evil',
    prompt:
      'The classic problem of evil usually distinguishes between two types of evil. What are they called?',
    choices: [
      'Big and small evil',
      'Moral and natural evil',
      'Real and imagined evil',
      'Past and future evil',
    ],
    correctChoiceIndex: 1,
  },

  // Steelman (roleplay: argue the skeptic's position fairly)
  {
    id: 'sm-1',
    type: 'STEELMAN',
    topic: 'problem-of-evil',
    prompt:
      "Argue as convincingly as you can for this position: \"If God is all-powerful and all-good, evil shouldn't exist — so either God isn't fully good, isn't fully powerful, or doesn't exist.\"",
  },
  {
    id: 'sm-2',
    type: 'STEELMAN',
    topic: 'pluralism',
    prompt:
      "Argue as convincingly as you can for this position: \"Sincere, intelligent people in every religion feel just as certain about their faith as Christians do about theirs — so certainty alone can't be evidence Christianity in particular is true.\"",
  },
  {
    id: 'sm-3',
    type: 'STEELMAN',
    topic: 'historicity',
    prompt:
      "Argue as convincingly as you can for this position: \"The Gospels were written decades after Jesus died, by people already convinced he was the Messiah — that's exactly the kind of environment where legend grows, not careful history.\"",
  },
  {
    id: 'sm-4',
    type: 'STEELMAN',
    topic: 'fine-tuning',
    prompt:
      "Argue as convincingly as you can for this position: \"A universe fine-tuned for life doesn't need a designer — if the constants were different, we simply wouldn't be here to notice, so of course we observe a universe compatible with our own existence.\"",
  },
  {
    id: 'sm-5',
    type: 'STEELMAN',
    topic: 'divine-hiddenness',
    prompt:
      'Argue as convincingly as you can for this position: "If Christianity were true, a loving God would make his existence obvious to everyone — the fact that reasonable, honest people don\'t believe suggests he either doesn\'t care or isn\'t there."',
  },

  // Comeback (a real objection is put to the player, who responds as themselves)
  {
    id: 'cb-1',
    type: 'COMEBACK',
    topic: 'problem-of-evil',
    prompt:
      'A friend says: "If God is loving, why does he allow children to suffer from horrible diseases?" How do you respond?',
  },
  {
    id: 'cb-2',
    type: 'COMEBACK',
    topic: 'textual-reliability',
    prompt:
      'A friend says: "The Bible has been translated and copied so many times, how can we trust it says anything like what was originally written?" How do you respond?',
  },
  {
    id: 'cb-3',
    type: 'COMEBACK',
    topic: 'science-faith',
    prompt:
      'A friend says: "Science has explained so much of what used to be attributed to God — eventually it\'ll explain everything, and there won\'t be a God-shaped gap left." How do you respond?',
  },
  {
    id: 'cb-4',
    type: 'COMEBACK',
    topic: 'comparative-mythology',
    prompt:
      'A friend says: "Christianity is just one more mythology like Zeus or Ra — why should anyone take this one more seriously than the others?" How do you respond?',
  },
  {
    id: 'cb-5',
    type: 'COMEBACK',
    topic: 'resurrection',
    prompt:
      'A friend says: "If Jesus really rose from the dead, why didn\'t he appear to the Roman authorities or the whole city, instead of just his followers?" How do you respond?',
  },
];

export function scoreQuickDraw(
  card: Card,
  responses: Record<string, string>
): RoundResult[] {
  return Object.entries(responses).map(([playerID, answer]) => {
    const isCorrect = Number(answer) === card.correctChoiceIndex;
    return {
      playerID,
      score: isCorrect ? 10 : 0,
      tip: isCorrect
        ? 'Correct!'
        : `The correct answer was "${card.choices?.[card.correctChoiceIndex ?? 0]}".`,
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- cards.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/game/cards.ts src/game/cards.test.ts
git commit -m "feat: add card model and 15-card Starter Deck"
```

---

## Task 3: Referee prompt/rubric builder

**Files:**
- Create: `src/referee/rubric.ts`
- Test: `src/referee/rubric.test.ts`

**Interfaces:**
- Consumes: `Card` from `src/game/cards.ts`.
- Produces: `interface RefereePrompt { system: string; user: string }` and `function buildRefereePrompt(card: Card, playerResponse: string): RefereePrompt`.

This is a pure function — no network calls — so it can be fully unit tested on its own, independent of the Anthropic SDK.

- [ ] **Step 1: Write the failing tests**

`src/referee/rubric.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- rubric.test.ts`
Expected: FAIL — `Cannot find module './rubric'`.

- [ ] **Step 3: Implement `src/referee/rubric.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- rubric.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/referee/rubric.ts src/referee/rubric.test.ts
git commit -m "feat: add AI referee rubric/prompt builder with brand guardrails"
```

---

## Task 4: Referee service (Anthropic API call)

**Files:**
- Create: `src/referee/refereeService.ts`
- Test: `src/referee/refereeService.test.ts`

**Interfaces:**
- Consumes: `Card` from `src/game/cards.ts`, `buildRefereePrompt` from `src/referee/rubric.ts`.
- Produces:
  - `class RefereeTimeoutError extends Error {}`
  - `interface RefereeResult { score: number; tip: string }`
  - `async function scoreResponse(client: Anthropic, card: Card, playerResponse: string): Promise<RefereeResult>` — takes the Anthropic client as a parameter (dependency injection) so tests can pass a mock instead of a real API client.

- [ ] **Step 1: Write the failing tests**

`src/referee/refereeService.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- refereeService.test.ts`
Expected: FAIL — `Cannot find module './refereeService'`.

- [ ] **Step 3: Implement `src/referee/refereeService.ts`**

```ts
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

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new RefereeTimeoutError('Referee call timed out')), REFEREE_TIMEOUT_MS)
  );

  const apiCall = client.messages.create({
    model: REFEREE_MODEL,
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: user }],
    tools: [SCORE_TOOL],
    tool_choice: { type: 'tool', name: 'submit_score' },
  });

  const response = await Promise.race([apiCall, timeout]);

  const toolUse = (response as Anthropic.Message).content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUse) {
    throw new RefereeTimeoutError('Referee did not return a score');
  }

  const input = toolUse.input as { score: number; tip: string };
  return { score: input.score, tip: input.tip };
}
```

Note: if `Anthropic.ToolUseBlock` or `Anthropic.Message` aren't the exact exported type names in the installed SDK version, check `node_modules/@anthropic-ai/sdk/resources/messages.d.ts` for the current names — the runtime shape (`content` array with `{ type: 'tool_use', input }` blocks) is stable across recent SDK versions.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- refereeService.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/referee/refereeService.ts src/referee/refereeService.test.ts
git commit -m "feat: add AI referee service calling Claude with a forced score tool"
```

---

## Task 5: boardgame.io game definition

**Files:**
- Create: `src/game/ApologeticsGame.ts`
- Test: `src/game/ApologeticsGame.test.ts`

**Interfaces:**
- Consumes: `Card`, `RoundResult`, `STARTER_DECK` from `src/game/cards.ts`.
- Produces:
  - `interface GameState { deck: Card[]; deckIndex: number; currentCard: Card | null; responses: Record<string, string>; claimedBy: string | null; scores: Record<string, number>; lastRoundResult: RoundResult[] | null }`
  - `const ApologeticsGame: Game<GameState>` with `name: 'apologetics'` and moves `drawCard()`, `claimRound()`, `submitAnswer(payload: string)`, `resolveRound(results: RoundResult[])`.

Round flow: `drawCard` advances the deck. For `QUICK_DRAW` cards, any player can call `submitAnswer` directly (everyone answers). For `STEELMAN`/`COMEBACK` cards, a player must call `claimRound` first — the first to claim is the only one whose subsequent `submitAnswer` is accepted. `resolveRound` adds the given scores to running totals, records `lastRoundResult` for the UI, and clears `currentCard` back to `null` until the host draws again.

- [ ] **Step 1: Write the failing tests**

`src/game/ApologeticsGame.test.ts`:

```ts
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { ApologeticsGame, GameState } from './ApologeticsGame';
import { STARTER_DECK } from './cards';

function makeClients(matchID: string) {
  const spec = { game: ApologeticsGame, numPlayers: 2, matchID };
  const client0 = Client({ ...spec, playerID: '0', multiplayer: Local() });
  const client1 = Client({ ...spec, playerID: '1', multiplayer: Local() });
  client0.start();
  client1.start();
  return { client0, client1 };
}

function drawUntilType(client: ReturnType<typeof Client>, type: string) {
  let card = (client.getState()!.G as GameState).currentCard;
  let guard = 0;
  while ((!card || card.type !== type) && guard < STARTER_DECK.length + 1) {
    if (card) client.moves.resolveRound([]);
    client.moves.drawCard();
    card = (client.getState()!.G as GameState).currentCard;
    guard++;
  }
  return card;
}

describe('ApologeticsGame', () => {
  it('starts with no current card and deckIndex -1', () => {
    const { client0 } = makeClients('start-test');
    const G = client0.getState()!.G as GameState;
    expect(G.currentCard).toBeNull();
    expect(G.deckIndex).toBe(-1);
  });

  it('drawCard advances to the next card in the deck', () => {
    const { client0 } = makeClients('draw-test');
    client0.moves.drawCard();
    const G = client0.getState()!.G as GameState;
    expect(G.currentCard).toEqual(STARTER_DECK[0]);
    expect(G.deckIndex).toBe(0);
  });

  it("records each player's answer independently for a QUICK_DRAW round", () => {
    const { client0, client1 } = makeClients('quickdraw-test');
    client0.moves.drawCard(); // STARTER_DECK[0] is QUICK_DRAW
    client0.moves.submitAnswer('1');
    client1.moves.submitAnswer('0');
    const G = client0.getState()!.G as GameState;
    expect(G.responses).toEqual({ '0': '1', '1': '0' });
  });

  it('only lets the first player who claims a STEELMAN round submit an answer', () => {
    const { client0, client1 } = makeClients('claim-test');
    const card = drawUntilType(client0, 'STEELMAN');
    expect(card?.type).toBe('STEELMAN');

    client1.moves.claimRound();
    client0.moves.claimRound(); // no-op — player 1 already claimed

    expect((client0.getState()!.G as GameState).claimedBy).toBe('1');

    client0.moves.submitAnswer('an argument from player 0'); // rejected, not the claimer
    client1.moves.submitAnswer('an argument from player 1');

    expect((client0.getState()!.G as GameState).responses).toEqual({
      '1': 'an argument from player 1',
    });
  });

  it('resolveRound adds scores, records the result, and clears the current card', () => {
    const { client0 } = makeClients('resolve-test');
    client0.moves.drawCard();
    client0.moves.resolveRound([{ playerID: '0', score: 10, tip: 'Correct!' }]);
    const G = client0.getState()!.G as GameState;
    expect(G.scores['0']).toBe(10);
    expect(G.currentCard).toBeNull();
    expect(G.lastRoundResult).toEqual([{ playerID: '0', score: 10, tip: 'Correct!' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- ApologeticsGame.test.ts`
Expected: FAIL — `Cannot find module './ApologeticsGame'`.

- [ ] **Step 3: Implement `src/game/ApologeticsGame.ts`**

```ts
import type { Game } from 'boardgame.io';
import { ActivePlayers } from 'boardgame.io/core';
import { Card, RoundResult, STARTER_DECK } from './cards';

export interface GameState {
  deck: Card[];
  deckIndex: number;
  currentCard: Card | null;
  responses: Record<string, string>;
  claimedBy: string | null;
  scores: Record<string, number>;
  lastRoundResult: RoundResult[] | null;
}

export const ApologeticsGame: Game<GameState> = {
  name: 'apologetics',

  setup: ({ ctx }): GameState => {
    const scores: Record<string, number> = {};
    for (let i = 0; i < ctx.numPlayers; i++) {
      scores[String(i)] = 0;
    }
    return {
      deck: STARTER_DECK,
      deckIndex: -1,
      currentCard: null,
      responses: {},
      claimedBy: null,
      scores,
      lastRoundResult: null,
    };
  },

  // Every player can act at any time — there's no rotating turn order in a
  // party game where anyone might buzz in or claim a round. If moves start
  // getting rejected as "not your turn," check
  // https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/stages.md
  // in case this field's shape has changed in the installed version.
  turn: {
    activePlayers: ActivePlayers.ALL,
  },

  moves: {
    drawCard: ({ G }) => {
      const nextIndex = G.deckIndex + 1;
      if (nextIndex >= G.deck.length) {
        return; // deck exhausted; host UI shows a "game over" state
      }
      G.deckIndex = nextIndex;
      G.currentCard = G.deck[nextIndex];
      G.responses = {};
      G.claimedBy = null;
      G.lastRoundResult = null;
    },

    claimRound: ({ G, playerID }) => {
      if (!G.currentCard || G.currentCard.type === 'QUICK_DRAW') return;
      if (G.claimedBy) return; // already claimed
      G.claimedBy = playerID;
    },

    submitAnswer: ({ G, playerID }, payload: string) => {
      if (!G.currentCard) return;

      if (G.currentCard.type === 'QUICK_DRAW') {
        G.responses[playerID] = payload;
        return;
      }

      if (G.claimedBy !== playerID) return; // must claim first
      G.responses[playerID] = payload;
    },

    resolveRound: ({ G }, results: RoundResult[]) => {
      for (const result of results) {
        G.scores[result.playerID] = (G.scores[result.playerID] ?? 0) + result.score;
      }
      G.lastRoundResult = results;
      G.currentCard = null;
    },
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- ApologeticsGame.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/game/ApologeticsGame.ts src/game/ApologeticsGame.test.ts
git commit -m "feat: add boardgame.io game definition for round/scoring state"
```

---

## Task 6: Game server with the referee endpoint

**Files:**
- Create: `src/server/index.ts`
- Test: `src/server/index.test.ts`

**Interfaces:**
- Consumes: `ApologeticsGame` from `src/game/ApologeticsGame.ts`, `STARTER_DECK` from `src/game/cards.ts`, `scoreResponse`/`RefereeTimeoutError` from `src/referee/refereeService.ts`.
- Produces: `function createServer()` returning a boardgame.io `Server` instance with a `POST /referee/score` route mounted on `server.router`. Request body: `{ cardId: string; response: string }`. Response body: `{ timedOut: false; score: number; tip: string } | { timedOut: true }`, or HTTP 400 `{ error: string }` for an unknown `cardId`.

- [ ] **Step 1: Install the body-parsing middleware**

```bash
npm install koa-bodyparser
npm install -D @types/koa-bodyparser
```

- [ ] **Step 2: Write the failing tests**

`src/server/index.test.ts`:

```ts
import request from 'supertest';
import { createServer } from './index';
import * as refereeService from '../referee/refereeService';
import { STARTER_DECK } from '../game/cards';

jest.mock('../referee/refereeService');

describe('POST /referee/score', () => {
  const server = createServer();
  const app = server.app.callback();

  afterEach(() => jest.resetAllMocks());

  it('returns the referee score for a known card', async () => {
    (refereeService.scoreResponse as jest.Mock).mockResolvedValue({
      score: 7,
      tip: 'Mention the historical creed in 1 Corinthians 15.',
    });

    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const res = await request(app)
      .post('/referee/score')
      .send({ cardId: comebackCard.id, response: 'my answer' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      timedOut: false,
      score: 7,
      tip: 'Mention the historical creed in 1 Corinthians 15.',
    });
  });

  it('returns 400 for an unknown card id', async () => {
    const res = await request(app)
      .post('/referee/score')
      .send({ cardId: 'not-a-real-card', response: 'my answer' });

    expect(res.status).toBe(400);
  });

  it('returns { timedOut: true } if the referee service throws RefereeTimeoutError', async () => {
    (refereeService.scoreResponse as jest.Mock).mockRejectedValue(
      new refereeService.RefereeTimeoutError('timed out')
    );

    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const res = await request(app)
      .post('/referee/score')
      .send({ cardId: steelmanCard.id, response: 'x' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timedOut: true });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- server/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 4: Implement `src/server/index.ts`**

```ts
import { Server, Origins } from 'boardgame.io/server';
import bodyParser from 'koa-bodyparser';
import Anthropic from '@anthropic-ai/sdk';
import { ApologeticsGame } from '../game/ApologeticsGame';
import { STARTER_DECK } from '../game/cards';
import { scoreResponse, RefereeTimeoutError } from '../referee/refereeService';

const PORT = Number(process.env.PORT) || 8000;

export function createServer() {
  const server = Server({
    games: [ApologeticsGame],
    origins: [Origins.LOCALHOST],
  });

  server.app.use(bodyParser());

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  server.router.post('/referee/score', async (ctx) => {
    const { cardId, response } = ctx.request.body as { cardId: string; response: string };
    const card = STARTER_DECK.find((c) => c.id === cardId);

    if (!card) {
      ctx.status = 400;
      ctx.body = { error: 'unknown card id' };
      return;
    }

    try {
      const result = await scoreResponse(anthropic, card, response);
      ctx.body = { timedOut: false, ...result };
    } catch (err) {
      if (err instanceof RefereeTimeoutError) {
        ctx.body = { timedOut: true };
        return;
      }
      throw err;
    }
  });

  return server;
}

if (require.main === module) {
  createServer().run(PORT);
  console.log(`Apologetics game server running on port ${PORT}`);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- server/index.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add src/server/index.ts src/server/index.test.ts package.json package-lock.json
git commit -m "feat: add game server with the AI referee scoring endpoint"
```

---

## Task 7: Host Display board

**Files:**
- Create: `src/client/HostBoard.tsx`
- Test: `src/client/HostBoard.test.tsx`

**Interfaces:**
- Consumes: `GameState`, `RoundResult` from `src/game/ApologeticsGame.ts` / `src/game/cards.ts`, `scoreQuickDraw` from `src/game/cards.ts`, `BoardProps` from `boardgame.io/react`.
- Produces: `function HostBoard({ G, moves }: BoardProps<GameState>): JSX.Element` — renders the shared-screen view: leaderboard, current card, response count, a "Resolve Round" button that scores Quick Draw locally or calls `/referee/score` for Steelman/Comeback (falling back to a host-entered manual score field if the call times out).

- [ ] **Step 1: Write the failing tests**

`src/client/HostBoard.test.tsx` (note the jsdom docblock — this project's default Jest environment is `node`):

```tsx
/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HostBoard } from './HostBoard';
import { GameState } from '../game/ApologeticsGame';
import { STARTER_DECK } from '../game/cards';

function baseG(overrides: Partial<GameState> = {}): GameState {
  return {
    deck: STARTER_DECK,
    deckIndex: -1,
    currentCard: null,
    responses: {},
    claimedBy: null,
    scores: { '0': 0, '1': 0 },
    lastRoundResult: null,
    ...overrides,
  };
}

describe('HostBoard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a Draw Card button when there is no current card', () => {
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    render(<HostBoard G={baseG()} moves={moves as any} ctx={{} as any} />);

    fireEvent.click(screen.getByText('Draw Card'));
    expect(moves.drawCard).toHaveBeenCalled();
  });

  it('resolves a QUICK_DRAW round locally using scoreQuickDraw, without calling fetch', async () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(
      <HostBoard
        G={baseG({ currentCard: quickDrawCard, responses: { '0': String(quickDrawCard.correctChoiceIndex) } })}
        moves={moves as any}
        ctx={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '0', score: 10, tip: 'Correct!' },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves a COMEBACK round using the referee endpoint', async () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ timedOut: false, score: 8, tip: 'Great point.' }),
    } as Response);

    render(
      <HostBoard
        G={baseG({ currentCard: comebackCard, claimedBy: '1', responses: { '1': 'my answer' } })}
        moves={moves as any}
        ctx={{} as any}
      />
    );

    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 8, tip: 'Great point.' },
    ]);
  });

  it('falls back to the manual score field if the referee times out', async () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { drawCard: jest.fn(), resolveRound: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ timedOut: true }),
    } as Response);

    render(
      <HostBoard
        G={baseG({ currentCard: comebackCard, claimedBy: '1', responses: { '1': 'my answer' } })}
        moves={moves as any}
        ctx={{} as any}
      />
    );

    fireEvent.change(screen.getByLabelText('manual score fallback'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('Resolve Round'));

    await waitFor(() => expect(moves.resolveRound).toHaveBeenCalled());
    expect(moves.resolveRound).toHaveBeenCalledWith([
      { playerID: '1', score: 6, tip: 'Scored by host (AI referee unavailable).' },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- HostBoard.test.tsx`
Expected: FAIL — `Cannot find module './HostBoard'`.

- [ ] **Step 3: Implement `src/client/HostBoard.tsx`**

```tsx
import React, { useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { GameState, RoundResult } from '../game/ApologeticsGame';
import { scoreQuickDraw } from '../game/cards';

type RefereeApiResponse =
  | { timedOut: true }
  | { timedOut: false; score: number; tip: string };

async function fetchRefereeScore(cardId: string, response: string): Promise<RefereeApiResponse> {
  const res = await fetch('/referee/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, response }),
  });
  return res.json();
}

export function HostBoard({ G, moves }: BoardProps<GameState>) {
  const [manualScore, setManualScore] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!G.currentCard) return;
    setResolving(true);

    if (G.currentCard.type === 'QUICK_DRAW') {
      const results = scoreQuickDraw(G.currentCard, G.responses);
      moves.resolveRound(results);
      setResolving(false);
      return;
    }

    const respondingPlayerID = G.claimedBy;
    if (!respondingPlayerID) {
      setResolving(false);
      return;
    }

    const playerResponse = G.responses[respondingPlayerID] ?? '';
    const refereeResult = await fetchRefereeScore(G.currentCard.id, playerResponse);

    const result: RoundResult = refereeResult.timedOut
      ? {
          playerID: respondingPlayerID,
          score: Number(manualScore) || 0,
          tip: 'Scored by host (AI referee unavailable).',
        }
      : { playerID: respondingPlayerID, score: refereeResult.score, tip: refereeResult.tip };

    moves.resolveRound([result]);
    setManualScore('');
    setResolving(false);
  };

  return (
    <div>
      <h1>Apologetics Party Game</h1>

      <section>
        <h2>Leaderboard</h2>
        <ul>
          {Object.entries(G.scores)
            .sort((a, b) => b[1] - a[1])
            .map(([playerID, score]) => (
              <li key={playerID}>
                Player {playerID}: {score}
              </li>
            ))}
        </ul>
      </section>

      {!G.currentCard && <button onClick={() => moves.drawCard()}>Draw Card</button>}

      {G.currentCard && (
        <section>
          <p>{G.currentCard.type}</p>
          <p>{G.currentCard.prompt}</p>
          {G.currentCard.type === 'QUICK_DRAW' && G.currentCard.choices && (
            <ol>
              {G.currentCard.choices.map((choice, i) => (
                <li key={i}>{choice}</li>
              ))}
            </ol>
          )}
          <p>{Object.keys(G.responses).length} response(s) received</p>
          <input
            aria-label="manual score fallback"
            value={manualScore}
            onChange={(e) => setManualScore(e.target.value)}
            placeholder="Manual score if AI referee is unavailable"
          />
          <button onClick={handleResolve} disabled={resolving}>
            Resolve Round
          </button>
        </section>
      )}

      {G.lastRoundResult && (
        <section>
          <h2>Last Round</h2>
          {G.lastRoundResult.map((r) => (
            <p key={r.playerID}>
              Player {r.playerID}: +{r.score} — {r.tip}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- HostBoard.test.tsx`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/client/HostBoard.tsx src/client/HostBoard.test.tsx
git commit -m "feat: add Host Display board with AI referee and manual fallback"
```

---

## Task 8: Player Controller board

**Files:**
- Create: `src/client/PlayerBoard.tsx`
- Test: `src/client/PlayerBoard.test.tsx`

**Interfaces:**
- Consumes: `GameState` from `src/game/ApologeticsGame.ts`, `BoardProps` from `boardgame.io/react`.
- Produces: `function PlayerBoard({ G, moves, playerID }: BoardProps<GameState>): JSX.Element` — the phone-controller view. Shows multiple-choice buttons for Quick Draw, or a "claim this round" step followed by a free-text box for Steelman/Comeback, and a waiting message once submitted or once another player has claimed the round.

- [ ] **Step 1: Write the failing tests**

`src/client/PlayerBoard.test.tsx`:

```tsx
/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerBoard } from './PlayerBoard';
import { GameState } from '../game/ApologeticsGame';
import { STARTER_DECK } from '../game/cards';

function baseG(overrides: Partial<GameState> = {}): GameState {
  return {
    deck: STARTER_DECK,
    deckIndex: -1,
    currentCard: null,
    responses: {},
    claimedBy: null,
    scores: { '0': 0, '1': 0 },
    lastRoundResult: null,
    ...overrides,
  };
}

describe('PlayerBoard', () => {
  it('shows a waiting message when no card has been drawn', () => {
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    render(<PlayerBoard G={baseG()} moves={moves as any} ctx={{} as any} playerID="0" />);
    expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
  });

  it('submits the choice index for a QUICK_DRAW card', () => {
    const quickDrawCard = STARTER_DECK.find((c) => c.type === 'QUICK_DRAW')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    render(
      <PlayerBoard
        G={baseG({ currentCard: quickDrawCard })}
        moves={moves as any}
        ctx={{} as any}
        playerID="0"
      />
    );

    fireEvent.click(screen.getByText(quickDrawCard.choices![0]));
    expect(moves.submitAnswer).toHaveBeenCalledWith('0');
  });

  it('shows a claim button first for a STEELMAN card, then a textarea after claiming', () => {
    const steelmanCard = STARTER_DECK.find((c) => c.type === 'STEELMAN')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };

    const { rerender } = render(
      <PlayerBoard
        G={baseG({ currentCard: steelmanCard })}
        moves={moves as any}
        ctx={{} as any}
        playerID="0"
      />
    );

    fireEvent.click(screen.getByText("I'll answer this one"));
    expect(moves.claimRound).toHaveBeenCalled();

    rerender(
      <PlayerBoard
        G={baseG({ currentCard: steelmanCard, claimedBy: '0' })}
        moves={moves as any}
        ctx={{} as any}
        playerID="0"
      />
    );

    fireEvent.change(screen.getByLabelText('your response'), { target: { value: 'my argument' } });
    fireEvent.click(screen.getByText('Submit'));
    expect(moves.submitAnswer).toHaveBeenCalledWith('my argument');
  });

  it('shows a waiting message when another player has claimed the round', () => {
    const comebackCard = STARTER_DECK.find((c) => c.type === 'COMEBACK')!;
    const moves = { submitAnswer: jest.fn(), claimRound: jest.fn() };
    render(
      <PlayerBoard
        G={baseG({ currentCard: comebackCard, claimedBy: '1' })}
        moves={moves as any}
        ctx={{} as any}
        playerID="0"
      />
    );
    expect(screen.getByText(/Player 1 is answering/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- PlayerBoard.test.tsx`
Expected: FAIL — `Cannot find module './PlayerBoard'`.

- [ ] **Step 3: Implement `src/client/PlayerBoard.tsx`**

```tsx
import React, { useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { GameState } from '../game/ApologeticsGame';

export function PlayerBoard({ G, moves, playerID }: BoardProps<GameState>) {
  const [freeText, setFreeText] = useState('');
  const myID = playerID ?? '';

  if (!G.currentCard) {
    return <p>Waiting for the host to draw a card...</p>;
  }

  const alreadySubmitted = G.responses[myID] !== undefined;

  if (G.currentCard.type === 'QUICK_DRAW') {
    if (alreadySubmitted) return <p>Answer submitted — waiting for other players.</p>;
    return (
      <div>
        <p>{G.currentCard.prompt}</p>
        {G.currentCard.choices?.map((choice, i) => (
          <button key={i} onClick={() => moves.submitAnswer(String(i))}>
            {choice}
          </button>
        ))}
      </div>
    );
  }

  // STEELMAN / COMEBACK
  if (G.claimedBy && G.claimedBy !== myID) {
    return <p>Player {G.claimedBy} is answering this round.</p>;
  }

  if (!G.claimedBy) {
    return (
      <div>
        <p>{G.currentCard.prompt}</p>
        <button onClick={() => moves.claimRound()}>I'll answer this one</button>
      </div>
    );
  }

  if (alreadySubmitted) {
    return <p>Response submitted — waiting for the host.</p>;
  }

  return (
    <div>
      <p>{G.currentCard.prompt}</p>
      <textarea
        aria-label="your response"
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
      />
      <button onClick={() => moves.submitAnswer(freeText)}>Submit</button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- PlayerBoard.test.tsx`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/client/PlayerBoard.tsx src/client/PlayerBoard.test.tsx
git commit -m "feat: add Player Controller board with claim-then-respond flow"
```

---

## Task 9: Wire up the client, match creation, and a local playtest guide

**Files:**
- Create: `src/client/url.ts`
- Test: `src/client/url.test.ts`
- Create: `src/client/index.tsx`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `scripts/create-match.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: `ApologeticsGame` from `src/game/ApologeticsGame.ts`, `HostBoard`, `PlayerBoard`.
- Produces: `interface Role { role: 'host' | 'player'; playerID?: string; matchID: string }` and `function parseRoleFromUrl(search: string): Role` — the one piece of pure, testable logic in this task. Everything else is wiring, verified manually at the end.

- [ ] **Step 1: Write the failing tests for the URL-parsing helper**

`src/client/url.test.ts`:

```ts
import { parseRoleFromUrl } from './url';

describe('parseRoleFromUrl', () => {
  it('parses host mode by default', () => {
    expect(parseRoleFromUrl('?match=abc123')).toEqual({ role: 'host', matchID: 'abc123' });
  });

  it('parses player mode with a playerID', () => {
    expect(parseRoleFromUrl('?match=abc123&role=player&playerID=1')).toEqual({
      role: 'player',
      playerID: '1',
      matchID: 'abc123',
    });
  });

  it('throws if match is missing', () => {
    expect(() => parseRoleFromUrl('?role=player&playerID=1')).toThrow(/match/i);
  });

  it('throws if player mode is missing a playerID', () => {
    expect(() => parseRoleFromUrl('?match=abc123&role=player')).toThrow(/playerID/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- url.test.ts`
Expected: FAIL — `Cannot find module './url'`.

- [ ] **Step 3: Implement `src/client/url.ts`**

```ts
export interface Role {
  role: 'host' | 'player';
  playerID?: string;
  matchID: string;
}

export function parseRoleFromUrl(search: string): Role {
  const params = new URLSearchParams(search);
  const matchID = params.get('match');
  if (!matchID) {
    throw new Error('Missing required "match" query parameter.');
  }

  if (params.get('role') === 'player') {
    const playerID = params.get('playerID');
    if (!playerID) {
      throw new Error('Player mode requires a "playerID" query parameter.');
    }
    return { role: 'player', playerID, matchID };
  }

  return { role: 'host', matchID };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- url.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/client/url.ts src/client/url.test.ts
git commit -m "feat: add URL-based role parsing for host/player client entry"
```

- [ ] **Step 6: Wire the client entry point**

`src/client/index.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { ApologeticsGame } from '../game/ApologeticsGame';
import { HostBoard } from './HostBoard';
import { PlayerBoard } from './PlayerBoard';
import { parseRoleFromUrl } from './url';

const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL ?? 'http://localhost:8000';

const { role, playerID, matchID } = parseRoleFromUrl(window.location.search);

const GameClient = Client({
  game: ApologeticsGame,
  board: role === 'host' ? HostBoard : PlayerBoard,
  multiplayer: SocketIO({ server: SERVER_URL }),
});

const root = createRoot(document.getElementById('root')!);
root.render(
  <GameClient matchID={matchID} playerID={role === 'player' ? playerID : undefined} />
);
```

- [ ] **Step 7: Add the Vite entry HTML and config**

`index.html` (repo root):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Apologetics Party Game</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/index.tsx"></script>
  </body>
</html>
```

`vite.config.ts` (repo root):

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The game server (Task 6) runs on a different port; proxy referee
    // calls so HostBoard's relative fetch('/referee/score') reaches it.
    // This proxy is a local-dev convenience only — a real deployment needs
    // its own reverse-proxy or CORS configuration, out of scope here.
    proxy: {
      '/referee': 'http://localhost:8000',
    },
  },
});
```

- [ ] **Step 8: Add the match-creation script**

`scripts/create-match.ts`:

```ts
const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:8000';

async function main() {
  const numPlayers = Number(process.argv[2]) || 4;
  const res = await fetch(`${SERVER_URL}/games/apologetics/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numPlayers }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create match: ${res.status} ${await res.text()}`);
  }

  const { matchID } = (await res.json()) as { matchID: string };
  console.log(`Match created for ${numPlayers} players.`);
  console.log(`Host screen: http://localhost:5173/?match=${matchID}`);
  for (let i = 0; i < numPlayers; i++) {
    console.log(`Player ${i}: http://localhost:5173/?match=${matchID}&role=player&playerID=${i}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Add the script to `package.json`'s `"scripts"` block (Task 1 already added the entry — confirm it's still there): `"create-match": "ts-node scripts/create-match.ts"`.

- [ ] **Step 9: Write the playtest README**

`README.md`:

```markdown
# Apologetics Party Game (MVP)

A same-room, shared-screen party game for church small groups and youth
groups — see `docs/superpowers/specs/2026-09-01-apologetics-party-game-design.md`
for the full design.

## Running a local playtest

You'll need three terminals and your `ANTHROPIC_API_KEY` exported in the one
running the server.

1. **Start the game server:**

   ```bash
   export ANTHROPIC_API_KEY=sk-...
   npm run dev:server
   ```

2. **Start the client dev server:**

   ```bash
   npm run dev:client
   ```

3. **Create a match** (replace `4` with your player count):

   ```bash
   npm run create-match 4
   ```

   This prints one host URL and one URL per player.

4. Open the host URL on the shared screen/TV, and open each player URL on
   that player's own phone (same Wi-Fi network as your computer — use your
   computer's LAN IP instead of `localhost` in the printed URLs if phones
   can't reach `localhost`).

5. On the host screen, click **Draw Card**, let players answer or claim the
   round on their phones, then click **Resolve Round**.
```

- [ ] **Step 10: Manually verify the full loop**

Run: `npm run dev:server` (in one terminal), `npm run dev:client` (in another), `npm run create-match 2` (in a third).
Expected: the script prints a host URL and two player URLs. Open the host URL and both player URLs in separate browser tabs. Click **Draw Card** on the host tab — a Quick Draw card should appear in all three tabs. Submit an answer from both player tabs, then click **Resolve Round** on the host tab — the leaderboard should update and the round should clear. Keep clicking **Draw Card** until a Steelman or Comeback card appears, claim it from one player tab, submit a response, and confirm **Resolve Round** either shows a real AI-referee score/tip or (if `ANTHROPIC_API_KEY` isn't set) times out into the manual-score field within a few seconds.

- [ ] **Step 11: Commit**

```bash
git add src/client/index.tsx index.html vite.config.ts scripts/create-match.ts README.md
git commit -m "feat: wire up client entry, match creation, and playtest instructions"
```

---

## Coverage check against the spec

- Core loop (spec §3): Tasks 5–9.
- Three card types (spec §4): Task 2 (data), Task 5 (claim/submit rules), Tasks 7–8 (UI).
- AI referee (spec §5): Tasks 3–4 (prompt/guardrails/service), Task 6 (endpoint), Task 7 (host-side call + fallback).
- Technical architecture — boardgame.io substrate, Host/Player clients, referee service (spec §6): Tasks 5–9. Accounts and hosting infra are explicitly out of scope for this plan (spec §9) and belong to Plan 2.
- Content (spec §7): Task 2 delivers the free Starter Deck; premium decks are out of scope for this plan.
- Testing & rollout (spec §8): Task 9, Step 10 is the manual walkthrough that makes the spec's real-group playtest possible; the playtest itself happens after this plan ships, not as part of it.
- Out of scope items (spec §9) are not implemented anywhere in this plan, matching the spec.
