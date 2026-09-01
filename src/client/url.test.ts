import { parseRoleFromUrl } from './url';

describe('parseRoleFromUrl', () => {
  it('parses host mode by default', () => {
    expect(parseRoleFromUrl('?match=abc123&playerID=2')).toEqual({
      role: 'host',
      playerID: '2',
      matchID: 'abc123',
    });
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

  it('throws if host mode is missing a playerID', () => {
    expect(() => parseRoleFromUrl('?match=abc123')).toThrow(/playerID/i);
  });
});
