import { MarkdownToWhatsApp, WhatsappToMarkdown } from './text';

describe('MarkdownToWhatsApp', () => {
  it('converts triple-backtick blocks', () => {
    const input = '```code block```';
    expect(MarkdownToWhatsApp(input)).toBe('```code block```');
  });
  it('converts italic and bold syntax', () => {
    const input = '*italic* **bold**';
    expect(MarkdownToWhatsApp(input)).toBe('_italic_ *bold*');
  });
  it('handles multiple transformations at once', () => {
    const input = `Here is a code block:\n\`\`\`some code\`\`\`\n**bold** *italic* ~~strike~~ [example](http://example.com)\n- item`;
    const expected = `Here is a code block:\n\`\`\`some code\`\`\`\n*bold* _italic_ ~strike~ example (http://example.com)\n* item`;
    expect(MarkdownToWhatsApp(input)).toBe(expected);
  });
});

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
