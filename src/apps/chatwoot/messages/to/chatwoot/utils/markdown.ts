import { UrlProtection } from '@waha/apps/chatwoot/messages/to/markdown';

export function WhatsappToMarkdown(text: string): string {
  if (!text) {
    return text;
  }
  if (text == '') {
    return '';
  }

  // Extract and protect URLs before formatting transformations
  const protection = new UrlProtection();
  const urls = protection.protect(text);
  text = urls.text;

  // Apply markdown transformations to "clean" text
  let result = text
    // Bold: *bold* → **bold**
    .replace(/\*(.*?)\*/g, '**$1**')
    // Strikethrough: ~strike~ → ~~strike~~
    .replace(/~(.*?)~/g, '~~$1~~')
    // Italic: _italic_ → *italic*
    .replace(/_(.*?)_/g, '*$1*');

  // Restore original URLs after all transformations
  result = urls.restore(result);
  return result;
}
