import { WhatsappToMarkdown } from './markdown';

describe('WhatsappToMarkdown', () => {
  it('converts asterisks to bold', () => {
    const input = '*bold*';
    expect(WhatsappToMarkdown(input)).toBe('**bold**');
  });
  it('converts underscores to italic', () => {
    const input = '_italic_';
    expect(WhatsappToMarkdown(input)).toBe('*italic*');
  });
  it('handles multiple transformations at once', () => {
    const input = `*bold* | _italic_ | ~strike~ | \`one line code\` | \`\`\`\nmultiple lines\`\`\` `;
    const expected = `**bold** | *italic* | ~~strike~~ | \`one line code\` | \`\`\`\nmultiple lines\`\`\` `;
    expect(WhatsappToMarkdown(input)).toBe(expected);
  });
});
