export const LOCALES = ['es', 'ja', 'ko', 'zh'];
export const DEFAULT_LOCALE = 'en';

export const HTML_LANG = {
  en: 'en',
  es: 'es',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh-CN',
};

export const TRANSLATED_PAGES = [
  'index',
  'compare',
  'pricing',
  'mcp',
  'contact',
  'alternatives/agentmail',
  'privacy-policy',
  'terms-of-service',
  'refund-policy',
];

/**
 * Generates an internal URL for a locale and page identifier.
 * Translated pages: /{locale}/ for index, /{locale}/{page} for others.
 * Untranslated pages: falls back to existing en URL as-is (e.g. /pricing, /compare).
 * English pages have no locale prefix.
 */
export function pageUrl(locale, page = 'index') {
  const clean = page === '/' ? 'index' : page.replace(/^\/+|\/+$/g, '') || 'index';
  if (locale === DEFAULT_LOCALE || !locale) {
    return clean === 'index' ? '/' : (page.startsWith('/') ? page : `/${page}`);
  }
  if (TRANSLATED_PAGES.includes(clean)) {
    return clean === 'index' ? `/${locale}/` : `/${locale}/${clean}`;
  }
  return page.startsWith('/') ? page : `/${page}`;
}
