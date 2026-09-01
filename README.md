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
