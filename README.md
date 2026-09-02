# Apologetics Party Game (MVP)

A same-room, shared-screen party game for church small groups and youth
groups — see `docs/superpowers/specs/2026-09-01-apologetics-party-game-design.md`
for the full design.

## Running a local playtest

You'll need three terminals and your `ANTHROPIC_API_KEY` exported in the one
running the server.

### Step 0: decide whether phones are joining

There are two setups, and they are **not** interchangeable:

- **Browser tabs on this one machine** (quick smoke test): skip to step 1 and
  ignore `HOST_LAN_IP` entirely. Everything runs on `localhost`.
- **Real playtest with phones**: every phone needs a URL pointing at *your
  computer*, not at itself. `localhost` on a phone means the phone, so you must
  use your computer's LAN IP everywhere. Find it with:

  ```bash
  # macOS (Wi-Fi is usually en0; try en1 if that returns nothing)
  ipconfig getifaddr en0

  # Linux
  hostname -I
  ```

  Export it once per terminal — **before** starting the server and the client,
  because both processes read it at startup:

  ```bash
  export HOST_LAN_IP=192.168.1.42   # substitute the address you just found
  ```

  All phones must be on the **same Wi-Fi network** as your computer, and that
  network must not have client isolation / "guest mode" enabled (many public
  and church guest networks do — if phones can't connect, that's the first
  thing to check).

### Step 1: start the game server

```bash
export ANTHROPIC_API_KEY=sk-...
export HOST_LAN_IP=192.168.1.42   # phones only; omit for a same-machine test
npm run dev:server
```

`HOST_LAN_IP` tells the server to accept browser requests originating from
`http://192.168.1.42:5173` in addition to `localhost`. Without it, phones are
rejected by the server's CORS/origin check even if they can reach it.

### Step 2: start the client dev server

```bash
export VITE_SERVER_URL=http://192.168.1.42:8000   # phones only
npm run dev:client
```

`VITE_SERVER_URL` is baked into the JavaScript bundle every phone downloads and
is what tells each phone where the game server lives. If you omit it, the
client falls back to the hostname the page was loaded from, which usually works
too — but setting it explicitly is the reliable path. The Vite dev server
already binds to all network interfaces (`host: true` in `vite.config.ts`), so
phones can reach it on port 5173.

### Step 3: create a match

```bash
export HOST_LAN_IP=192.168.1.42   # phones only
npm run create-match 4            # replace 4 with your phone-player count
```

This prints one host URL and one URL per player. With `HOST_LAN_IP` set, all
printed URLs use that address; without it they use `localhost` and the script
prints a reminder that phones can't use them.

`HOST_LAN_IP` can also be passed as a flag instead of an environment variable:

```bash
npm run create-match -- 4 --host 192.168.1.42
```

### Step 4: play

1. Open the host URL on the shared screen/TV.
2. Open each player URL on that player's own phone.
3. On the host screen, click **Draw Card**, let players answer or claim the
   round on their phones, then click **Resolve Round**.
4. If the AI referee is unavailable, the host screen switches to a manual
   scoring prompt — type a score and click **Award Manual Score** to finish the
   round. Nothing is scored until you do.
5. After all 15 cards, the host screen shows a game-over message with the final
   scores instead of the **Draw Card** button.

### Reviewing referee output afterwards

The server logs one JSON line per successfully scored response
(`{"event":"referee_score", ...}`). Pipe `npm run dev:server` to a file if you
want to review the night's referee tips for brand-guardrail violations:

```bash
npm run dev:server 2>&1 | tee playtest.log
grep referee_score playtest.log
```

### Troubleshooting phone connections

| Symptom | Likely cause |
| --- | --- |
| Phone can't load the page at all | Wrong IP, different Wi-Fi network, client isolation, or a firewall blocking ports 5173/8000 |
| Page loads but the game never connects | `VITE_SERVER_URL` / `HOST_LAN_IP` not exported before starting the client and server |
| Browser console shows a CORS error | Server was started without `HOST_LAN_IP` (or with a different value than the URLs use) |
