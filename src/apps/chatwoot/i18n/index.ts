import * as path from 'path';
import { YamlLocaleLoader } from '@waha/apps/chatwoot/i18n/loader';
import { I18N } from '@waha/apps/chatwoot/i18n/i18n';

const i18n = new I18N();
const localesDir = path.join(__dirname, 'locales');
// Load both .yml and .yaml files from locales directory (non-recursive)
i18n.load(new YamlLocaleLoader(localesDir, 'yml').load());
i18n.load(new YamlLocaleLoader(localesDir, 'yaml').load());

// Resolve env var (supports '.' and '~'); fallback to default
const additional = process.env.WAHA_APPS_CHATWOOT_LANGUAGES_FOLDER?.trim();
if (additional) {
  const resolved = path.resolve(additional);
  i18n.load(new YamlLocaleLoader(resolved, 'yml').load());
  i18n.load(new YamlLocaleLoader(resolved, 'yaml').load());
}

export { i18n };
