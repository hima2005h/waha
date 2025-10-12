import * as Mustache from 'mustache';
import { TemplatePayloads, TKey } from '@waha/apps/chatwoot/i18n/templates';
import Long from 'long';
import { ensureNumber } from '@waha/core/engines/noweb/utils';

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

  FormatDate(date: Date | null): string | null {
    if (!date) {
      return null;
    }
    const options: any = this.strings['datetime'] || {};
    options.timezone = options.timeZone ?? process.env.TZ;
    return date.toLocaleString(options.locales, options);
  }

  FormatTimestamp(timestamp: Long | string | number | null): string | null {
    const value = ensureNumber(timestamp);
    if (!value) {
      return undefined;
    }
    if (!Number.isFinite(value)) {
      return undefined;
    }
    const milliseconds = value >= 1e12 ? value : value * 1000;
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return this.FormatDate(date);
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
