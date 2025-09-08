import * as Mustache from 'mustache';
import { TemplatePayloads, TKey } from '@waha/apps/chatwoot/i18n/templates';

export class Locale {
  constructor(private readonly strings: Record<string, string>) {}

  key<K extends TKey>(key: K): Template<K> {
    return new Template(this.strings[key] || key);
  }

  /**
   * Overrides the existing strings with the provided strings for the locale.
   * Merges the new strings with the current strings.
   */
  override(strings: Record<string, string>): Locale {
    return new Locale({ ...this.strings, ...strings });
  }
}

export class Template<K extends TKey> {
  constructor(private readonly template: string) {}

  render(data: TemplatePayloads[K]): string {
    return Mustache.render(this.template, data);
  }

  r(data: TemplatePayloads[K]): string {
    return this.render(data);
  }
}
