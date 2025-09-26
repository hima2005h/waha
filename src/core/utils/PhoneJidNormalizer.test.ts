import { E164Parser } from './PhoneJidNormalizer';

describe('E164Parser.fromJid', () => {
  it('parses basic JID to +number', () => {
    expect(E164Parser.fromJid('14155552671@s.whatsapp.net')).toBe(
      '+14155552671',
    );
  });

  it('returns null for empty or missing local part', () => {
    expect(E164Parser.fromJid('')).toBeNull();
    expect(E164Parser.fromJid('@s.whatsapp.net')).toBeNull();
  });

  it('applies Brazil DDD + add-9 rule when local has 8 digits and not starting with 9', () => {
    // +55 <DDD:2> <local:8> and local does not start with 9
    expect(E164Parser.fromJid('553188888888@s.whatsapp.net')).toBe(
      '+5531988888888',
    );
  });

  it('does not add 9 when local already starts with 9 (Brazil)', () => {
    expect(E164Parser.fromJid('553198888888@s.whatsapp.net')).toBe(
      '+553198888888',
    );
    expect(E164Parser.fromJid('553199999999@s.whatsapp.net')).toBe(
      '+553199999999',
    );
  });

  it('leaves non-Brazil numbers unchanged', () => {
    expect(E164Parser.fromJid('447911123456@s.whatsapp.net')).toBe(
      '+447911123456',
    );
  });
});
