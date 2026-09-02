import { parseArgs } from './create-match';

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
