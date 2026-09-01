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
