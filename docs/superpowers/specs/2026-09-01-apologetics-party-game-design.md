# Apologetics Party Game — Design Spec

*Working title only — naming is an open item, see Open Questions.*

## 1. Purpose

A card-based party game, played in person by a group (youth group, small
group, church gathering) around a shared screen, that builds people's
confidence and skill in engaging tough questions about Christianity —
without feeling like a quiz night someone can "fail," and without treating
apologetics as a debate-bro exercise in dunking on skeptics.

This is an **official Apologist Project product** — the same org behind
apologist.ai — released as a **freemium** offering: a free starter deck
drives adoption and top-of-funnel brand reach, and premium topic decks are
gated behind the org's existing paid church accounts ($99/$249 tiers),
giving those churches an additional reason to stay subscribed and
differentiating against Gospel Bots / Gloo Ministry Chat.

## 2. Audience & tone

Primary audience: church small groups and youth groups playing together in
person, one shared screen (TV/projector) plus each player's own phone as a
controller. Not designed for fully remote or mixed in-person/remote play in
v1 (see Out of Scope).

Tone follows the org's existing brand voice doc directly — confident, not
defensive; scripture-cited, not scripture-decorative; historically grounded;
risk-aware about hard questions rather than falsely triumphalist. The
biggest risk to "not corny" is either (a) treating this as Bible trivia
where only the most theologically literate player wins, or (b) having any
AI-driven feedback speak as though it personally believes something. Both
are addressed structurally below, not just as a style note.

## 3. Core game loop

1. Host opens the game on a shared screen. A room code / QR appears.
2. Players join on their own phone browsers as controllers — no app install.
3. Host taps **Draw Card**. A card comes up from the active deck, tagged
   with one of three types (color-coded) that determines the round's
   mechanic (Section 4).
4. Players respond via their phone (multiple-choice, free text, or
   voice-to-text depending on card type).
5. The AI referee (Section 5) scores the round and gives a short
   improvement tip. Scores post to a running leaderboard on the host
   screen.
6. Repeat for a set number of rounds or a timer.
7. Game ends with a lightweight recap: best answer of the night, a couple
   of the sharpest referee tips from the session. No somber debrief — this
   stays a party game with a scoreboard, not a study session.

## 4. Card types (v1: three)

- **Quick Draw** (trivia/speed) — a fast factual or logical question,
  ~15-second timer, all players answer simultaneously on their phones,
  graded for correctness and speed. Serves as the pace-keeper between
  heavier rounds and gives newer/less-studied players quick wins.
- **Steelman** (roleplay) — the player must argue the *skeptic's* position
  as fairly and convincingly as possible for ~30-45 seconds (typed or
  voice-to-text), then is judged on whether they represented it honestly
  and compellingly. Trains genuine understanding of objections rather than
  strawmanning; structurally resistant to feeling like a "gotcha" game
  since the win condition is empathy and accuracy, not scoring points off
  an opponent.
- **Comeback** (objection → response) — a real skeptic's objection is
  drawn from the deck; the player responds (typed or voice-to-text) and is
  scored on accuracy, charity of tone, and clarity, with a short "a
  stronger answer might also mention..." tip citing a real source.

A fourth type ("Common Ground" — find genuine agreement with the objection
before pivoting to a response) is a good phase-2 candidate once the core
three prove out with real playtests. Not in v1 scope.

## 5. AI referee

The referee is what makes this "useful, not corny" rather than just a fun
app — every round ends in real feedback grounded in real sources, not a
friend's off-the-cuff judgment call.

- **Grounding**: scores and tips are generated against the org's existing
  partner content (Got Questions Ministries, Stand to Reason, Bible
  Project, Ligonier, Reasons to Believe), ideally by reusing whatever
  content/retrieval pipeline apologist.ai already has rather than building
  a second one. *Requires confirming with the org's engineering team
  whether that pipeline is accessible to a second product — see Open
  Questions.*
- **Never anthropomorphized**: the referee cites sources ("Stand to
  Reason's summary of this argument notes...") rather than speaking as if
  it holds a belief. This is a hard brand-voice guardrail already in place
  for apologist.ai, applied here without exception.
- **Confident, not falsely triumphalist**: on genuinely hard objections
  (e.g. the problem of evil), the referee can acknowledge "this is one
  thoughtful Christians have wrestled with for centuries" rather than
  implying every objection has a tidy one-liner rebuttal.
- **Latency & fallback**: uses a fast-tier model to keep round pace snappy
  in a live room. If the AI call is slow or fails, the host can manually
  award points for that round rather than the game stalling — a room full
  of teenagers will not wait patiently on an API call.

## 6. Technical architecture

- **Framework substrate: [boardgame.io](https://github.com/boardgameio/boardgame.io)**
  — open source, actively maintained, purpose-built for turn-based games
  needing state sync across a host view and multiple player views, with
  reconnect handling and real-time networking built in. Chosen specifically
  so engineering effort goes into the game's differentiated parts (content,
  mechanics, AI referee) rather than re-solving multiplayer plumbing.
  - Considered and ruled out: **AirConsole**, which is the "obvious" fit
    for phone-controller + shared-screen games but is a closed
    console/marketplace platform — its distribution model conflicts with
    running a fully white-labeled, freemium, church-branded product that
    the org owns and monetizes directly.
- **Host Display** client: card reveal, round timer, leaderboard.
- **Player Controller** client: mobile browser view; input changes per
  round type (buttons for Quick Draw, free text/voice-to-text for Steelman
  and Comeback).
- **AI referee service**: thin service taking `{card prompt, player
  response, scoring rubric}`, calling a fast-tier LLM grounded against the
  partner-content index, returning `{score, one-line tip}`.
- **Accounts**: reuse the org's existing church-admin login/billing system
  rather than standing up a second auth system, since churches already
  have accounts for the SaaS tiers.
- **Hosting**: modest scale — concurrent game-night "rooms," not
  internet-scale traffic. Runs on ordinary infra consistent with the org's
  current scale.

## 7. Content & tiers

- **Free Starter Deck**: broad, evergreen topics — problem of evil,
  resurrection evidence, "aren't all religions basically the same,"
  science & faith. A full night's worth of content; drives adoption.
- **Premium decks** (unlocked per paid church account): deeper/niche
  topics — specific worldviews, current cultural objections, age-targeted
  content (middle schoolers vs. adults).
- Card content (objections, trivia questions, roleplay scenarios) is
  authored and reviewed against the same partner sources the org already
  trusts. This is a content production workstream that runs alongside
  engineering — engineering does not generate deck content unassisted.
- Church branding on the host screen (logo/colors) is a natural phase-2
  paid perk. Not core v1 scope.

## 8. Testing & rollout plan

- Playtest with 1-2 real small/youth groups in person before any wider
  release. Specifically watch: whether trivia rounds keep energy up
  between heavier rounds, whether the AI referee's tone lands as helpful
  or preachy, and whether pacing holds a group's attention for a full
  session.
- Soft-launch to a small set of existing paying churches (a known, trusted
  audience) before a fully public release.
- Success signal: "would you play this again next week," plus zero
  brand-guardrail violations (anthropomorphizing, doctrinal drift) observed
  in referee output across the playtest sample.

## 9. Out of scope (v1)

- Remote / mixed remote-and-in-person play (confirmed same-room-only for
  v1; revisit only if demand shows up post-launch).
- Fourth card type ("Common Ground").
- Church branding/customization of the host screen.
- Any native mobile app — the player controller is a mobile browser page
  reached via QR code/room code, no app-store install.

## 10. Open questions

- **Content pipeline reuse**: can the AI referee actually query
  apologist.ai's existing partner-content retrieval system, or does this
  need its own (smaller) content index built from the same source
  licenses? Needs a conversation with whoever owns apologist.ai's
  backend/content pipeline.
- **LLM provider**: which model/provider the AI referee calls should match
  whatever apologist.ai's production backend already uses, for consistency
  of tone and to avoid a second vendor relationship — needs confirming
  with engineering rather than assumed here.
- **Game name/branding**: no name has been chosen yet. Should reflect the
  brand voice (confident, not gimmicky) — a naming pass is a separate,
  small follow-up task, not blocking the technical design.
- **Church-admin auth system**: this design assumes an existing
  church-admin login/billing system on the B2B SaaS side that can be
  reused — needs confirming that one actually exists and is reusable by a
  second product.
