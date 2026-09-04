import { parseArgs, buildMatchUrls } from './create-match';

describe('parseArgs', () => {
  it('defaults to 4 phone players and no host IP with no arguments', () => {
    expect(parseArgs([])).toEqual({ phonePlayerCount: 4, hostLanIp: undefined });
  });

  it('parses a positional player count', () => {
    expect(parseArgs(['6'])).toEqual({ phonePlayerCount: 6, hostLanIp: undefined });
  });

  it('falls back to 4 players when the positional argument is not a number', () => {
    expect(parseArgs(['not-a-number'])).toEqual({ phonePlayerCount: 4, hostLanIp: undefined });
  });

  it('parses the --host=IP inline form', () => {
    expect(parseArgs(['3', '--host=192.168.1.42'])).toEqual({
      phonePlayerCount: 3,
      hostLanIp: '192.168.1.42',
    });
  });

  it('parses --host IP as two separate tokens without treating the IP as positional', () => {
    expect(parseArgs(['--host', '192.168.1.42', '5'])).toEqual({
      phonePlayerCount: 5,
      hostLanIp: '192.168.1.42',
    });
  });

  it('does not crash when --host is the last argument with no value', () => {
    expect(parseArgs(['--host'])).toEqual({ phonePlayerCount: 4, hostLanIp: undefined });
  });
});

describe('buildMatchUrls', () => {
  it('builds single-origin https links with no port when publicServerUrl is set', () => {
    const urls = buildMatchUrls({
      matchID: 'abc123',
      phonePlayerCount: 2,
      hostPlayerID: '2',
      publicServerUrl: 'https://apologist-game.onrender.com',
    });

    expect(urls.host).toBe('https://apologist-game.onrender.com/?match=abc123&role=host&playerID=2');
    expect(urls.players).toEqual([
      'https://apologist-game.onrender.com/?match=abc123&role=player&playerID=0',
      'https://apologist-game.onrender.com/?match=abc123&role=player&playerID=1',
    ]);
  });

  it('ignores hostLanIp when publicServerUrl is set', () => {
    const urls = buildMatchUrls({
      matchID: 'abc123',
      phonePlayerCount: 1,
      hostPlayerID: '1',
      publicServerUrl: 'https://apologist-game.onrender.com',
      hostLanIp: '192.168.1.42',
    });

    expect(urls.host).toBe('https://apologist-game.onrender.com/?match=abc123&role=host&playerID=1');
  });

  it('falls back to dev-style LAN URLs with the client port when publicServerUrl is unset', () => {
    const urls = buildMatchUrls({
      matchID: 'abc123',
      phonePlayerCount: 1,
      hostPlayerID: '1',
      hostLanIp: '192.168.1.42',
    });

    expect(urls.host).toBe('http://192.168.1.42:5173/?match=abc123&role=host&playerID=1');
    expect(urls.players).toEqual(['http://192.168.1.42:5173/?match=abc123&role=player&playerID=0']);
  });

  it('falls back to localhost when neither publicServerUrl nor hostLanIp is set', () => {
    const urls = buildMatchUrls({
      matchID: 'abc123',
      phonePlayerCount: 1,
      hostPlayerID: '1',
    });

    expect(urls.host).toBe('http://localhost:5173/?match=abc123&role=host&playerID=1');
  });
});
