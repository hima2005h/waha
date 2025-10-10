import { MarkdownToWhatsApp } from './markdown';

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
