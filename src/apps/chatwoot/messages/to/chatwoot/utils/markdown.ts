export function WhatsappToMarkdown(text: string): string {
  if (!text) {
    return text;
  }
  if (text == '') {
    return '';
  }
  return (
    text
      // Bold: *bold* → **bold**
      .replace(/\*(.*?)\*/g, '**$1**')
      // Strikethrough: ~strike~ → ~~strike~~
      .replace(/~(.*?)~/g, '~~$1~~')
      // Italic: _italic_ → *italic*
      .replace(/_(.*?)_/g, '*$1*')
  );
}
